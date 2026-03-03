## Front-end Connecting to Websocket Server Core Methods

```JavaScript
var connectionId = ""; // The unique ID of the front-end page in this communication

var targetWSId = ""; // The unique ID of the app in this communication

let followAStrength = false; // Follow AB soft upper limit

let followBStrength = false;

var wsConn = null; // Global ws connection object

function connectWs() {
    wsConn = new WebSocket("ws://12.34.56.78:9999/"); // Please change the content to your ws server address

    // ws is a persistent connection, so officially several states are defined to facilitate your processing of information. The onopen event is automatically called after the ws connection is successfully established. Here we only print the state.
    wsConn.onopen = function (event) {
        console.log("WebSocket connection established");
    };

    // Next, we define the communication protocol. The ws messages are sent back and forth between the two connected parties through the persistent connection, so we need to actively define the communication protocol.
    wsConn.onmessage = function (event) {
        var message = null;
        try {
            // Get message content
            message = JSON.parse(event.data);
        }
        catch (e) {
            // Exception handling for messages not conforming to JSON format
            console.log(event.data);
            return;
        }

        // According to message.type to perform different processing, we have defined the message body format, the types are all strings {type, clientId, targetId, message}
        switch (message.type) {
            case 'bind':// The first thing upon connecting is to bind, first letting the front-end page and the server bind a unique id for this communication
                if (!message.targetId) {
                    // When the connection is created, the ws server generates an id for this communication and passes it to the front-end via clientId (this clientId is for the front-end to use)
                    connectionId = message.clientId; // Get clientId
                    console.log("Received clientId: " + message.clientId);
                    qrcodeImg.clear();
                    // Generate a QR code through the qrcode.min.js library, which is then scanned by the app to create a connection with the server (when the app scans this QR code, the server side will know that the app needs to bind with the front-end page, generate a new targetId to return to the app, and bind this pair of clientId and targetId in the server. This serves as the unique sign of communication legitimacy authentication in this connection. Afterwards, every time the two send messages to each other, both targetId and clientId must be carried, and the server will authenticate whether it is a legitimate message to prevent others from illegally sending messages to the app and front-end, avoiding malicious intensity modifications.
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://12.34.56.78:9999/" + connectionId);
                    //qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://192.168.3.235:9999/" + connectionId);
                }
                else {
                    if (message.clientId != connectionId) {
                        alert('Received incorrect target message' + message.message)
                        return;
                    }
                    // After the app scans the QR code, the server completes the creation of the targetId, and needs to notify the front-end that the binding is completed. The front-end also saves the targetId, and then normal communication can begin (remember to carry targetId and clientId every time you send a message, put waveform content/intensity setting and other information in message, and set type to msg)
                    targetWSId = message.targetId;
                    console.log("Received targetId: " + message.targetId + " msg: " + message.message);
                    hideqrcode();
                }
                break;
            case 'break':
                // When the app disconnects, the server notifies the front-end to end this game session
                if (message.targetId != targetWSId)
                    return;
                showToast("The other party has disconnected, code: " + message.message)
                location.reload();
                break;
            case 'error':
                // When abnormal situations and flow errors occur on the server, remind the front-end
                if (message.targetId != targetWSId)
                    return;
                console.log(message); // Output error information to console
                showToast(message.message); // Pop up error prompt box, display error message
                break;
            case 'msg':
                // Official communication starts, for the message encoding format, please check the APP receiving protocol in socket/readme.md
                // First define an empty array to store the result
                const result = [];
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    result.push({ type: "strength", numbers });
                    document.getElementById("channel-a").innerText = numbers[0]; // parse a channel intensity
                    document.getElementById("channel-b").innerText = numbers[1];// parse b channel intensity
                    document.getElementById("soft-a").innerText = numbers[2];// parse a channel intensity soft upper limit
                    document.getElementById("soft-b").innerText = numbers[3];// parse b channel intensity soft upper limit

                    if (followAStrength && numbers[2] !== numbers[0]) {
                        // enable follow soft upper limit setting. Triggers automatic setting when receiving a soft upper limit value different from the cache
                        softAStrength = numbers[2]; // Save to avoid repeated message sending
                        const data1 = { type: 4, message: `strength-1+2+${numbers[2]}` }
                        sendWsMsg(data1);
                    }
                    if (followBStrength && numbers[3] !== numbers[1]) {
                        softBStrength = numbers[3]
                        const data2 = { type: 4, message: `strength-2+2+${numbers[3]}` }
                        sendWsMsg(data2);
                    }
                }
                else if (message.message.includes("feedback")) {
                    showSuccessToast(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                // Heartbeat packet, used to monitor whether this communication is abnormally disconnected due to network instability
                console.log("Received heartbeat");
                if (targetWSId !== '') {
                    // Connected
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';

                    // Set color back to #ffe99d after 1 second
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                console.log("Received other message: " + JSON.stringify(message)); // Output other types of messages to console
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("WebSocket connection error occurred");
        // One of the methods provided by websocket, handle the situation of connection error here
    };

    wsConn.onclose = function (event) {
        // One of the methods provided by websocket, handle operations after the connection is closed here, such as resetting page settings
        showToast("Connection has been disconnected");
    };
}
```

## Back-end Websocket Service Core Methods

```JavaScript
// Required ws connection library
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Store all connected clients, this includes front-end and app, need to check if the connection exists during subsequent message forwarding
const clients = new Map();

// Store communication relationships, clientId is key, targetId is value. In this example, it allows establishing a one-to-one relationship between front-end and app.
// If you want to set it to a one-to-N relationship, please modify the save strategy of Map (set the relationship corresponding to targetId to an array instead of a key-value)
const relations = new Map();

const punishmentDuration = 5; // Default sending time 5 seconds

const punishmentTime = 1; // Default send once a second

// Store the relationship between client and sending timer. Each client has a timer when sending waveform messages. This timer is used for issuing waveform data, for example, sending 1 time per second, sending for a total of 5 seconds.
const clientTimers = new Map();

// Define heartbeat message to inform all connected clients that the server is working normally, if not received for a long time, it will automatically disconnect (indicating network anomaly)
const heartbeatMsg = {
    type: "heartbeat",
    clientId: "",
    targetId: "",
    message: "200"
};

// Define heartbeat timer, independent of the sending timer, as long as the ws service is started, this timer will continue to work
let heartbeatInterval;

const wss = new WebSocket.Server({ port: 9999 }); // Define the connection port, choose an available port on your server according to requirements

wss.on('connection', function connection(ws) {
    // Method provided by ws, automatically called when connected
    // Generate unique identifier clientId
    const clientId = uuidv4();

    console.log('New WebSocket connection established, identifier is: ', clientId);

    // Store this clientId
    clients.set(clientId, ws);

    // Send identifier to client (fixed format, both parties must obtain it to proceed with subsequent communication: such as browser and APP, the server acts only as a state manager and message forwarding tool)
    ws.send(JSON.stringify({ type: 'bind', clientId, message: 'targetId', targetId: '' }));

    // Server listens to messages sent by both parties and processes messages
    ws.on('message', function incoming(message) {
        console.log("Received message: " + message)
        let data = null;
        try {
            data = JSON.parse(message);
        }
        catch (e) {
            // Non-JSON format data processing
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '403' }))
            return;
        }

        // Reject illegal message sources, clientId and targetId are not a bound relationship
        if (clients.get(data.clientId) !== ws && clients.get(data.targetId) !== ws) {
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '404' }))
            return;
        }

        if (data.type && data.clientId && data.message && data.targetId) {
            // Prioritise processing the binding relationship between clientId and targetId
            const { clientId, targetId, message, type } = data;
            switch (data.type) {
                case "bind":
                    // Server issues binding relationship
                    if (clients.has(clientId) && clients.has(targetId)) {
                        // Neither of these two ids exist in both parties of relations to be bound, preventing app from binding to multiple front-ends
                        if (![clientId, targetId].some(id => relations.has(id) || [...relations.values()].includes(id))) {
                            relations.set(clientId, targetId)
                            const client = clients.get(clientId);
                            const sendData = { clientId, targetId, message: "200", type: "bind" }
                            ws.send(JSON.stringify(sendData));
                            client.send(JSON.stringify(sendData));
                        }
                        else {
                            // This id has been bound, refuse to bind again
                            const data = { type: "bind", clientId, targetId, message: "400" }
                            ws.send(JSON.stringify(data))
                            return;
                        }
                    } else {
                        const sendData = { clientId, targetId, message: "401", type: "bind" }
                        ws.send(JSON.stringify(sendData));
                        return;
                    }
                    break;
                     // Official communication begins, for the message encoding format please view APP receiving protocol in socket/readme.md
                case 1:
                case 2:
                case 3:
                    // clientId requests to adjust the intensity of targetId, the server issues APP intensity adjustment after authenticating the link is legitimate
                    if (invalidRelation(clientId, targetId, ws)) return; // Authenticate if it is a binding relationship
                        const client = clients.get(targetId);
                        const sendType = data.type - 1;
                        const sendChannel = data.channel ? data.channel : 1;
                        const sendStrength = data.type >= 3 ? data.strength : 1 // increase mode intensity changed to 1
                        const msg = "strength-" + sendChannel + "+" + sendType + "+" + sendStrength;
                        const sendData = { type: "msg", clientId, targetId, message: msg }
                        client.send(JSON.stringify(sendData));
                    break;
                case 4:
                    // clientId requests to specify the intensity of targetId, the server issues specified APP intensity after authenticating the link is legitimate
                    if (invalidRelation(clientId, targetId, ws)) return; // Authenticate if it is a binding relationship

                        const client2 = clients.get(targetId);
                        const sendData2 = { type: "msg", clientId, targetId, message }
                        client2.send(JSON.stringify(sendData2));

                    break;
                case "clientMsg":
                    // Waveform message sent by clientId to targetId, message issued to client by server after authenticating the link is legitimate
                    if (invalidRelation(clientId, targetId, ws)) return; // Authenticate if it is a binding relationship

                    if (!data.channel) {
                        // 240531. Now the channel must be specified (allowing only one currently playing waveform to be overridden at a time)
                        const errData = { type: "error", clientId, targetId, message: "406-channel is empty" }
                        ws.send(JSON.stringify(errData))
                        return;
                    }

                        // Message body defaults to at least one waveform message
                        let sendtime = data.time ? data.time : punishmentDuration; // Execution time of AB channel
                        const target = clients.get(targetId); // Send to target app
                        const sendDataPulse = { type: "msg", clientId, targetId, message: "pulse-" + data.message }
                        let totalSends = punishmentTime * sendtime;
                        const timeSpace = 1000 / punishmentTime;

                        if (clientTimers.has(clientId + "-" + data.channel)) {
                            // A channel timer has not finished working yet, clear the timer and send clear APP queue message, delay 150ms and resend new data
                            // New message overrides old message logic, in the case of triggering waveform output multiple times, the new waveform will override the old waveform
                            console.log("Channel " + data.channel + " overriding message sending, total messages: " + totalSends + " duration A: " + sendtime)
                            ws.send("Current channel " + data.channel + " has a message being sent, overriding previous message")

                            const timerId = clientTimers.get(clientId + "-" + data.channel);
                            clearInterval(timerId); // Clear timer
                            clientTimers.delete(clientId + "-" + data.channel); // Clear corresponding item in Map

                            // Because there is a waveform queue in the App to ensure the correct playback sequence of waveforms, an APP waveform queue clear command needs to be sent before the new waveform overrides the old waveform
                            switch (data.channel) {
                                case "A":
                                    const clearDataA = { clientId, targetId, message: "clear-1", type: "msg" }
                                    target.send(JSON.stringify(clearDataA));
                                    break;

                                case "B":
                                    const clearDataB = { clientId, targetId, message: "clear-2", type: "msg" }
                                    target.send(JSON.stringify(clearDataB));
                                    break;
                                default:
                                    break;
                            }

                            setTimeout(() => {
                                delaySendMsg(clientId, ws, target, sendDataPulse, totalSends, timeSpace, data.channel);
                            }, 150);
                        }
                        else {
                            // If there are no unsent waveform messages, there is no need to clear the waveform queue, send directly
                            delaySendMsg(clientId, ws, target, sendDataPulse, totalSends, timeSpace, data.channel);
                            console.log("Channel " + data.channel + " message sending, total messages: " + totalSends + " duration: " + sendtime)
                        }

                    break;

                default:
                    // Undefined other messages, generally used as prompt messages
                   if (invalidRelation(clientId, targetId, ws)) return; // Authenticate if it is a binding relationship

                        const clientDefault = clients.get(clientId);
                        const sendDataDefault = { type, clientId, targetId, message }
                        clientDefault.send(JSON.stringify(sendDataDefault));

                    break;
            }
        }
    });

    ws.on('close', function close() {
        // When connection is closed, clear corresponding clientId and WebSocket instance
        console.log('WebSocket connection closed');
        // Traverse clients Map, find and delete the corresponding clientId entry
        let clientId = '';
        clients.forEach((value, key) => {
            if (value === ws) {
                // Get disconnected client id
                clientId = key;
            }
        });
        console.log("Disconnected client id: " + clientId)
        relations.forEach((value, key) => {
            if (key === clientId) {
                // Webpage disconnected, notify app
                let appid = relations.get(key)
                let appClient = clients.get(appid)
                const data = { type: "break", clientId, targetId: appid, message: "209" }
                appClient.send(JSON.stringify(data))
                appClient.close(); // Close current WebSocket connection
                relations.delete(key); // Clear relationship
                console.log("The other party is offline, close " + appid);
            }
            else if (value === clientId) {
                // App disconnected, notify webpage
                let webClient = clients.get(key)
                const data = { type: "break", clientId: key, targetId: clientId, message: "209" }
                webClient.send(JSON.stringify(data))
                webClient.close(); // Close current WebSocket connection
                relations.delete(key); // Clear relationship
                console.log("The other party is offline, close " + clientId);
            }
        })
        clients.delete(clientId); // Clear ws client
        console.log("Cleared " + clientId + " , current size: " + clients.size)
    });

    ws.on('error', function (error) {
        // Error handling
        console.error('WebSocket exception: ', error.message);
        // Notify user of exception here, send message to both parties via WebSocket
        let clientId = '';
        // Find the clientId corresponding to the current WebSocket instance
        for (const [key, value] of clients.entries()) {
            if (value === ws) {
                clientId = key;
                break;
            }
        }
        if (!clientId) {
            console.error('Cannot find corresponding clientId');
            return;
        }
        // Construct error message
        const errorMessage = 'WebSocket exception: ' + error.message;

        relations.forEach((value, key) => {
            // Traverse relations Map, find and notify the party that is not offline
            if (key === clientId) {
                // Notify app
                let appid = relations.get(key)
                let appClient = clients.get(appid)
                const data = { type: "error", clientId: clientId, targetId: appid, message: "500" }
                appClient.send(JSON.stringify(data))
            }
            if (value === clientId) {
                // Notify webpage
                let webClient = clients.get(key)
                const data = { type: "error", clientId: key, targetId: clientId, message: errorMessage }
                webClient.send(JSON.stringify(data))
            }
        })
    });

    // Start heartbeat timer (if not already started)
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            // Traverse clients Map (greater than 0 connections), send heartbeat message to each client
            if (clients.size > 0) {
                console.log(relations.size, clients.size, 'Send heartbeat message: ' + new Date().toLocaleString());
                clients.forEach((client, clientId) => {
                    heartbeatMsg.clientId = clientId;
                    heartbeatMsg.targetId = relations.get(clientId) || '';
                    client.send(JSON.stringify(heartbeatMsg));
                });
            }
        }, 60 * 1000); // Send heartbeat message once per minute
    }
});

function delaySendMsg(clientId, client, target, sendData, totalSends, timeSpace, channel) {
    // Sending timer. Channels will respectively send different messages and different quantities. Must wait until all are sent completely before this message is cancelled. New messages can override.
    // Waveform messages are controlled by this timer to send by time. Waveform length is 1 second, for example, default output waveform is 5 seconds, so it needs to send to the app 5 times in sequence, timeSpace is set to 1000ms.
    // If the waveform length you defined in the front-end is not 1 second, then you need to control the timeSpace sending delay of this timer to prevent the waveform from being overwritten and played.

    target.send(JSON.stringify(sendData)); // Timer starts, send the channel message for the first time immediately
    totalSends--; // Total sending number
    if (totalSends > 0) {
        return new Promise((resolve, reject) => {
            // Send messages to a specific client at the set frequency
            const timerId = setInterval(() => {
                if (totalSends > 0) {
                    target.send(JSON.stringify(sendData));
                    totalSends--;
                }
                // If the total sending number is reached, stop the timer
                if (totalSends <= 0) {
                    clearInterval(timerId);
                    client.send("Sending completed")
                    clientTimers.delete(clientId); // Delete the corresponding timer
                    resolve();
                }
            }, timeSpace); // Trigger timer once every inverse of the frequency, generally consistent with the waveform length

            // Store clientId and its corresponding timerId and waveform channel, in order to confirm whether there are waveforms being sent at the next receipt. If so, override it, preventing multiple timers from scrambling to send messages.
            clientTimers.set(clientId + "-" + channel, timerId);
        });
    }
}

function invalidRelation(clientId, targetId, ws) {
    // Relationship legitimacy authentication, clientId and targetId must exist in the client collection, and relationship must be bound in the relation collection
    if (relations.get(clientId) !== targetId) {
        const data = { type: "bind", clientId, targetId, message: "402" }
        ws.send(JSON.stringify(data))
        return true;
    }
    if (!clients.has(clientId) || !clients.has(targetId)) {
        console.log(`Matching client not found, clientId: ${clientId}`);
        const data = { type: "bind", clientId, targetId, message: "404" }
        ws.send(JSON.stringify(data))
        return true;
    }
    return false;
}
```