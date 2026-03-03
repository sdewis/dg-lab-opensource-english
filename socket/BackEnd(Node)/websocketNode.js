const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Store connected users and their identifiers
const clients = new Map();

// Store message relations
const relations = new Map();

const punishmentDuration = 5; // Default sending time 5 seconds

const punishmentTime = 1; // Default send once a second

// Store relationship between client and sending timer
const clientTimers = new Map();

// Define heartbeat message
const heartbeatMsg = {
    type: "heartbeat",
    clientId: "",
    targetId: "",
    message: "200"
};

// Define timer
let heartbeatInterval;

const wss = new WebSocket.Server({ port: 9999 });

wss.on('connection', function connection(ws) {
    // Generate unique identifier
    const clientId = uuidv4();

    console.log('New WebSocket connection established, identifier is:', clientId);

    // Store
    clients.set(clientId, ws);

    // Send identifier to client (fixed format, both parties must obtain it to proceed with subsequent communication: such as browser and APP)
    ws.send(JSON.stringify({ type: 'bind', clientId, message: 'targetId', targetId: '' }));

    // Listen to messages
    ws.on('message', function incoming(message) {
        console.log("Received message:", message)
        let data = null;
        try {
            data = JSON.parse(message);
        }
        catch (e) {
            // Non-JSON data processing
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '403' }))
            return;
        }

        // Reject illegal message sources
        if (clients.get(data.clientId) !== ws && clients.get(data.targetId) !== ws) {
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '404' }))
            return;
        }

        if (data.type && data.clientId && data.message && data.targetId) {
            // Prioritise processing binding relationship
            const { clientId, targetId, message, type } = data;
            switch (data.type) {
                case "bind":
                    // Server issues binding relationship
                    if (clients.has(clientId) && clients.has(targetId)) {
                        // Neither of these two ids exist in both parties of relations
                        if (![clientId, targetId].some(id => relations.has(id) || [...relations.values()].includes(id))) {
                            relations.set(clientId, targetId)
                            const client = clients.get(clientId);
                            const sendData = { clientId, targetId, message: "200", type: "bind" }
                            ws.send(JSON.stringify(sendData));
                            client.send(JSON.stringify(sendData));
                        }
                        else {
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
                case 1:
                case 2:
                case 3:
                    // Server issues APP intensity adjustment
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(targetId)) {
                        const client = clients.get(targetId);
                        const sendType = data.type - 1;
                        const sendChannel = data.channel ? data.channel : 1;
                        const sendStrength = data.type >= 3 ? data.strength : 1 // Increase mode intensity changed to 1
                        const msg = "strength-" + sendChannel + "+" + sendType + "+" + sendStrength;
                        const sendData = { type: "msg", clientId, targetId, message: msg }
                        client.send(JSON.stringify(sendData));
                    }
                    break;
                case 4:
                    // Server issues specified APP intensity
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(targetId)) {
                        const client = clients.get(targetId);
                        const sendData = { type: "msg", clientId, targetId, message }
                        client.send(JSON.stringify(sendData));
                    }
                    break;
                case "clientMsg":
                    // Message issued by server to client
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (!data.channel) {
                        // 240531. Now the channel must be specified (allowing only one currently playing waveform to be overridden at a time)
                        const errData = { type: "error", clientId, targetId, message: "406-channel is empty" }
                        ws.send(JSON.stringify(errData))
                        return;
                    }
                    if (clients.has(targetId)) {
                        // Message body defaults to at least one message
                        let sendtime = data.time ? data.time : punishmentDuration; // Execution time of AB channel
                        const target = clients.get(targetId); // Target to send
                        const sendData = { type: "msg", clientId, targetId, message: "pulse-" + data.message }
                        let totalSends = punishmentTime * sendtime;
                        const timeSpace = 1000 / punishmentTime;

                        if (clientTimers.has(clientId + "-" + data.channel)) {
                            // A channel timer has not finished working yet, clear timer and send clear APP queue message, delay 150ms and resend new data
                            // New message overrides old message logic
                            console.log("Channel " + data.channel + " overriding message sending, total messages:", totalSends, "duration A:", sendtime)
                            ws.send("Current channel " + data.channel + " has a message being sent, overriding previous message")

                            const timerId = clientTimers.get(clientId + "-" + data.channel);
                            clearInterval(timerId); // Clear timer
                            clientTimers.delete(clientId + "-" + data.channel); // Clear corresponding item in Map

                            // Send APP waveform queue clear command
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
                                delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
                            }, 150);
                        } 
                        else {
                            // If there are no unsent messages, send directly
                            delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
                            console.log("Channel " + data.channel + " message sending, total messages:", totalSends, "duration:", sendtime)
                        }
                    } else {
                        console.log(`Matching client not found, clientId: ${clientId}`);
                        const sendData = { clientId, targetId, message: "404", type: "msg" }
                        ws.send(JSON.stringify(sendData));
                    }
                    break;
                default:
                    // Undefined ordinary message
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(clientId)) {
                        const client = clients.get(clientId);
                        const sendData = { type, clientId, targetId, message }
                        client.send(JSON.stringify(sendData));
                    } else {
                        // Matching client not found
                        const sendData = { clientId, targetId, message: "404", type: "msg" }
                        ws.send(JSON.stringify(sendData));
                    }
                    break;
            }
        }
    });

    ws.on('close', function close() {
        // When connection is closed, clear corresponding clientId and WebSocket instance
        console.log('WebSocket connection closed');
        // Traverse clients Map, find and delete corresponding clientId entry
        let clientId = '';
        clients.forEach((value, key) => {
            if (value === ws) {
                // Get disconnected client id
                clientId = key;
            }
        });
        console.log("Disconnected client id:" + clientId)
        relations.forEach((value, key) => {
            if (key === clientId) {
                // Webpage disconnected, notify app
                let appid = relations.get(key)
                let appClient = clients.get(appid)
                const data = { type: "break", clientId, targetId: appid, message: "209" }
                appClient.send(JSON.stringify(data))
                appClient.close(); // Close current WebSocket connection
                relations.delete(key); // Clear relation
                console.log("The other party is offline, close " + appid);
            }
            else if (value === clientId) {
                // App disconnected, notify webpage
                let webClient = clients.get(key)
                const data = { type: "break", clientId: key, targetId: clientId, message: "209" }
                webClient.send(JSON.stringify(data))
                webClient.close(); // Close current WebSocket connection
                relations.delete(key); // Clear relation
                console.log("The other party is offline, close " + clientId);
            }
        })
        clients.delete(clientId); // Clear ws client
        console.log("Cleared " + clientId + " , current size: " + clients.size)
    });

    ws.on('error', function (error) {
        // Error processing
        console.error('WebSocket exception:', error.message);
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
            // Traverse clients Map (greater than 0 links), send heartbeat message to each client
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
    target.send(JSON.stringify(sendData)); // Send channel message immediately once
    totalSends--;
    if (totalSends > 0) {
        return new Promise((resolve, reject) => {
            // Send messages to a specific client at frequency
            const timerId = setInterval(() => {
                if (totalSends > 0) {
                    target.send(JSON.stringify(sendData));
                    totalSends--;
                }
                // If the maximum number of sends is reached, stop the timer
                if (totalSends <= 0) {
                    clearInterval(timerId);
                    client.send("Sending completed")
                    clientTimers.delete(clientId); // Delete the corresponding timer
                    resolve();
                }
            }, timeSpace); // Trigger timer once every inverse of the frequency

            // Store clientId and its corresponding timerId and channel
            clientTimers.set(clientId + "-" + channel, timerId);
        });
    }
}