var connectionId = ""; // Connection identifier obtained from the interface
var targetWSId = ""; // Sending target
var fangdou = 500; // 500ms debounce
var fangdouSetTimeOut; // Debounce timer
let followAStrength = false; // Follow AB soft upper limit
let followBStrength = false;
var wsConn = null; // Global ws link

// Reconnection state
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 1000; // 1 second

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

function updateStatusUI(status, isError = false) {
    const statusEl = document.getElementById("status");
    const lightEl = document.getElementById("status-light");
    const btnEl = document.getElementById("status-btn");

    if (!statusEl || !lightEl || !btnEl) return;

    statusEl.innerText = status;
    if (isError) {
        statusEl.classList.add("red");
        lightEl.classList.add("red");
        btnEl.innerText = "Connect";
        btnEl.classList.remove("red-background");
    } else if (status === "Connected") {
        statusEl.classList.remove("red");
        lightEl.classList.remove("red");
        btnEl.innerText = "Disconnect";
        btnEl.classList.add("red-background");
    } else {
        statusEl.classList.add("red");
        lightEl.classList.add("red");
        btnEl.innerText = "Connect";
        btnEl.classList.remove("red-background");
    }
}

function connectWs() {
    // Please change the content to your ws server address
    const wsUrl = "ws://12.34.56.78:9999/";
    wsConn = new WebSocket(wsUrl);

    wsConn.onopen = function (event) {
        console.log("WebSocket connection established");
        reconnectAttempts = 0;
        updateStatusUI("Connected");
    };

    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            console.log("Raw message:", event.data);
            return;
        }

        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    connectionId = message.clientId;
                    console.log("Received clientId: " + message.clientId);
                    qrcodeImg.clear();
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#" + wsUrl + connectionId);
                } else {
                    if (message.clientId != connectionId) {
                        console.error('Received incorrect target message', message.message);
                        return;
                    }
                    targetWSId = message.targetId;
                    updateStatusUI("Connected");
                    console.log("Received targetId: " + message.targetId + " msg: " + message.message);
                    hideqrcode();
                }
                break;
            case 'break':
                if (message.targetId != targetWSId) return;
                showToast("The other party has disconnected, code: " + message.message);
                // Instead of reload, we just reset the state
                targetWSId = "";
                updateStatusUI("Disconnected");
                showqrcode();
                break;
            case 'error':
                if (message.targetId != targetWSId) return;
                console.error("Server error:", message);
                showToast(message.message);
                break;
            case 'msg':
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    document.getElementById("channel-a").innerText = numbers[0];
                    document.getElementById("channel-b").innerText = numbers[1];
                    document.getElementById("soft-a").innerText = numbers[2];
                    document.getElementById("soft-b").innerText = numbers[3];

                    if (followAStrength && numbers[2] !== numbers[0]) {
                        softAStrength = numbers[2];
                        sendWsMsg({ type: 4, message: `strength-1+2+${numbers[2]}` });
                    }
                    if (followBStrength && numbers[3] !== numbers[1]) {
                        softBStrength = numbers[3];
                        sendWsMsg({ type: 4, message: `strength-2+2+${numbers[3]}` });
                    }
                } else if (message.message.includes("feedback")) {
                    showSuccessToast(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                console.log("Received heartbeat");
                if (targetWSId !== '') {
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                console.log("Received other message: " + JSON.stringify(message));
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("WebSocket connection error occurred");
        updateStatusUI("Connection Error", true);
    };

    wsConn.onclose = function (event) {
        console.log("WebSocket connection closed");
        updateStatusUI("Disconnected");
        
        // Auto-reconnect logic
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`Attempting to reconnect in ${delay}ms... (Attempt ${reconnectAttempts})`);
            updateStatusUI(`Reconnecting (${reconnectAttempts})...`);
            setTimeout(connectWs, delay);
        } else {
            showToast("Maximum reconnection attempts reached. Please refresh the page.");
        }
    };
}

// Auto connect
connectWs();

function sendWsMsg(messageObj) {
    if (!wsConn || wsConn.readyState !== WebSocket.OPEN) {
        console.warn("Cannot send message: WebSocket is not open.");
        return;
    }
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type')) messageObj.type = "msg";
    wsConn.send(JSON.stringify(messageObj));
}

function addOrIncrease(type, channelIndex, strength) {
    const channelElement = document.getElementById(channelIndex === 1 ? "channel-a" : "channel-b");
    let currentValue = parseInt(channelElement.innerText);

    if (type === 3) {
        currentValue = 0;
    } else if (type === 1) {
        currentValue = Math.max(currentValue - strength, 0);
    } else if (type === 2) {
        currentValue = Math.min(currentValue + strength, 200);
    }

    const data = { type, strength: currentValue, message: "set channel", channel: channelIndex };
    sendWsMsg(data);
}

function clearAB(channelIndex) {
    sendWsMsg({ type: 4, message: "clear-" + channelIndex });
}

function autoAddStrength(channelId, inputId, currentId, follow) {
    if (!follow) {
        let addStrength = parseInt(document.getElementById(inputId).value, 10);
        let currentStrength = parseInt(document.getElementById(currentId).innerText, 10);
        let setTo = addStrength + currentStrength;
        if (addStrength > 0) {
            sendWsMsg({ type: 4, message: `strength-${channelId}+2+${setTo}` });
        }
    }
}

function sendCustomMsg() {
    if (fangdouSetTimeOut) return;

    autoAddStrength(1, "failed-a", "channel-a", followAStrength);
    autoAddStrength(2, "failed-b", "channel-b", followBStrength);

    const selectA = document.getElementById("wave-a").value;
    const selectB = document.getElementById("wave-b").value;
    const timeA = parseInt(document.getElementById("time-a").value, 10);
    const timeB = parseInt(document.getElementById("time-b").value, 10);

    sendWsMsg({ type: "clientMsg", message: `A:${waveData[selectA]}`, time: timeA, channel: "A" });
    sendWsMsg({ type: "clientMsg", message: `B:${waveData[selectB]}`, time: timeB, channel: "B" });

    fangdouSetTimeOut = setTimeout(() => {
        fangdouSetTimeOut = null;
    }, fangdou);
}

function showToast(message) {
    new Notyf().error(message);
}

function showSuccessToast(message) {
    new Notyf().success(message);
}

function toggleSwitch(id) {
    const container = document.getElementById(id);
    container.classList.toggle('on');
    const switchState = container.classList.contains('on');
    
    if (id === 'toggle1') followAStrength = switchState;
    else followBStrength = switchState;

    const currentStrength = parseInt(document.getElementById(id === 'toggle1' ? 'channel-a' : 'channel-b').innerText);
    const currentSoft = parseInt(document.getElementById(id === 'toggle1' ? 'soft-a' : 'soft-b').innerText);

    if (switchState && currentStrength !== currentSoft) {
        const channel = id === 'toggle1' ? 1 : 2;
        sendWsMsg({ type: 4, message: `strength-${channel}+2+${currentSoft}` });
    }
}

function connectOrDisconn() {
    if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        // User manually requested disconnect - stop auto-reconnect
        reconnectAttempts = maxReconnectAttempts; 
        wsConn.close();
        showToast("Disconnected by user");
    } else {
        reconnectAttempts = 0;
        connectWs();
    }
}