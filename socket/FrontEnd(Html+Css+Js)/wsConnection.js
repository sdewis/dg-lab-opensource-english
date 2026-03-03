var connectionId = ""; // Connection identifier obtained from the interface

var targetWSId = ""; // Sending target

var fangdou = 500; //500ms debounce

var fangdouSetTimeOut; // Debounce timer

let followAStrength = false; //Follow AB soft upper limit

let followBStrength = false;

var wsConn = null; // Global ws link

const feedBackMsg = {
    "feedback-0": "Channel A: ○",
    "feedback-1": "Channel A: △",
    "feedback-2": "Channel A: □",
    "feedback-3": "Channel A: ☆",
    "feedback-4": "Channel A: ⬡",
    "feedback-5": "Channel B: ○",
    "feedback-6": "Channel B: △",
    "feedback-7": "Channel B: □",
    "feedback-8": "Channel B: ☆",
    "feedback-9": "Channel B: ⬡",
}

const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`
}

function connectWs() {
    wsConn = new WebSocket("ws://12.34.56.78:9999/");
    //wsConn = new WebSocket("ws://localhost:9999/");
    wsConn.onopen = function (event) {
        console.log("WebSocket connection established");
    };

    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        }
        catch (e) {
            console.log(event.data);
            return;
        }

        // 根据 message.type 进行不同的处理
        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    //Initial connection to get webpage wsid
                    connectionId = message.clientId; // Get clientId
                    console.log("Received clientId:" + message.clientId);
                    qrcodeImg.clear();
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://12.34.56.78:9999/" + connectionId);
                    //qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://192.168.3.235:9999/" + connectionId);
                }
                else {
                    if (message.clientId != connectionId) {
                        alert('Received incorrect target message' + message.message)
                        return;
                    }
                    targetWSId = message.targetId;
                    document.getElementById("status").innerText = "Connected";
                    document.getElementById("status").classList.remove("red");
                    document.getElementById("status-light").classList.remove("red");
                    document.getElementById("status-btn").innerText = "Disconnect";
                    document.getElementById("status-btn").classList.add("red-background");
                    console.log("Received targetId: " + message.targetId + "msg: " + message.message);
                    hideqrcode();
                }
                break;
            case 'break':
                //对方Disconnect
                if (message.targetId != targetWSId)
                    return;
                showToast("对方已Disconnect，code:" + message.message)
                location.reload();
                break;
            case 'error':
                if (message.targetId != targetWSId)
                    return;
                console.log(message); // Output error information to console
                showToast(message.message); // Pop up error prompt box, display error message
                break;
            case 'msg':
                // Define an empty array to store the result
                const result = [];
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    result.push({ type: "strength", numbers });
                    document.getElementById("channel-a").innerText = numbers[0];
                    document.getElementById("channel-b").innerText = numbers[1];
                    document.getElementById("soft-a").innerText = numbers[2];
                    document.getElementById("soft-b").innerText = numbers[3];

                    if (followAStrength && numbers[2] !== numbers[0]) {
                        //Enable follow soft upper limit. Triggers automatic setting when receiving a soft upper limit value different from the cache
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
                //Heartbeat packet
                console.log("Received heartbeat");
                if (targetWSId !== '') {
                    // Connected上
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
        // Handle the situation of connection error here
    };

    wsConn.onclose = function (event) {
        showToast("连接已Disconnect");
    };
}

// Auto connect
connectWs();

function sendWsMsg(messageObj) {
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type'))
        messageObj.type = "msg";
    wsConn.send(JSON.stringify((messageObj)));
}

function toggleSwitch(id) {
    const element = document.getElementById(id);
    element.classList.toggle("switch-on");
    element.classList.toggle("switch-off");
}

function addOrIncrease(type, channelIndex, strength) {
    // 1 decrease by one 2 increase by one 3 set to
    // channel:1-A    2-B
    // Get current channel element and current value
    const channelElement = document.getElementById(channelIndex === 1 ? "channel-a" : "channel-b");
    let currentValue = parseInt(channelElement.innerText);

    // If it is a set operation
    if (type === 3) {
        currentValue = 0; //Fixed to 0
    }
    // Decrease by one
    else if (type === 1) {
        currentValue = Math.max(currentValue - strength, 0);
    }
    // Increase by one
    else if (type === 2) {
        currentValue = Math.min(currentValue + strength, 200);
    }

    // Construct message object and send
    const data = { type, strength: currentValue, message: "set channel", channel: channelIndex };
    console.log(data)
    sendWsMsg(data);
}

function clearAB(channelIndex) {
    const data = { type: 4, message: "clear-" + channelIndex }
    sendWsMsg(data);
}

function autoAddStrength(channelId, inputId, currentId, follow) {
    // Check whether follow soft upper limit is enabled
    if (!follow) {
        let addStrength = parseInt(document.getElementById(inputId).value, 10);
        let currentStrength = parseInt(document.getElementById(currentId).innerText, 10);
        let setTo = addStrength + currentStrength;
        if (addStrength > 0) {
            const data = { type: 4, message: `strength-${channelId}+2+${setTo}` }
            sendWsMsg(data);
        }
    }
}

function sendCustomMsg() {
    if (fangdouSetTimeOut) {
        return;
    }

    autoAddStrength(1, "failed-a", "channel-a", followAStrength); // Increase intensity for channel A
    autoAddStrength(2, "failed-b", "channel-b", followBStrength); // Increase intensity for channel B

    const selectA = document.getElementById("wave-a").value;
    const selectB = document.getElementById("wave-b").value;
    const timeA = parseInt(document.getElementById("time-a").value, 10);
    const timeB = parseInt(document.getElementById("time-b").value, 10);

    const msg1 = `A:${waveData[selectA]}`;
    const msg2 = `B:${waveData[selectB]}`;

    const dataA = { type: "clientMsg", message: msg1, time: timeA, channel: "A" }
    const dataB = { type: "clientMsg", message: msg2, time: timeB, channel: "B" }
    sendWsMsg(dataA)
    sendWsMsg(dataB)

    fangdouSetTimeOut = setTimeout(() => {
        clearTimeout(fangdouSetTimeOut);
        fangdouSetTimeOut = null;
    }, fangdou);

}

function showToast(message) {
    let notyf = new Notyf();
    // Display a success notification
    //notyf.success(message);

    notyf.error(message);
}

function showSuccessToast(message) {
    let notyf = new Notyf();
    notyf.success(message);
}

function toggleSwitch(id) {
    // Get switch element and toggle switch state
    const container = document.getElementById(id);
    container.classList.toggle('on');
    const switch1State = container.classList.contains('on');
    followAStrength = id === 'toggle1' ? switch1State : followAStrength;
    followBStrength = id === 'toggle2' ? switch1State : followBStrength;

    const currentStrength = parseInt(document.getElementById(id === 'toggle1' ? 'channel-a' : 'channel-b').innerText);
    const currentSoft = parseInt(document.getElementById(id === 'toggle1' ? 'soft-a' : 'soft-b').innerText);

    console.log(switch1State + '@' + currentStrength + '@' + currentSoft)

    if (switch1State && currentStrength !== currentSoft) {
        //Immediately judge whether it complies with the soft upper limit
        console.log('Does not comply, change immediately')
        const channel = id === 'toggle1' ? 1 : 2;
        const data = { type: 4, message: `strength-${channel}+2+${currentSoft}` }
        sendWsMsg(data);
    }
}

function connectOrDisconn() {
    // If not connected, display QR code
    if (wsConn && targetWSId === '') {
        showqrcode();
        return;
    } else {
        wsConn.close();
        showToast("已Disconnect连接");
        location.reload();
    }
}