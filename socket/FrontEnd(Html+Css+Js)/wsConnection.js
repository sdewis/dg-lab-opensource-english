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

// Latency monitor
let lastPingTime = 0;
let pingInterval = null;

// Waveform visualiser
let waveformDataA = new Array(50).fill(0);
let waveformDataB = new Array(50).fill(0);
let canvas = null;
let ctx = null;

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
    const latencyMon = document.getElementById("latency-monitor");

    if (!statusEl || !lightEl || !btnEl) return;

    statusEl.innerText = status;
    if (isError) {
        statusEl.classList.add("red");
        lightEl.classList.add("red");
        btnEl.innerText = "Connect";
        btnEl.classList.remove("red-background");
        if (latencyMon) latencyMon.style.display = "none";
    } else if (status === "Connected") {
        statusEl.classList.remove("red");
        lightEl.classList.remove("red");
        btnEl.innerText = "Disconnect";
        btnEl.classList.add("red-background");
        if (latencyMon) latencyMon.style.display = "block";
    } else {
        statusEl.classList.add("red");
        lightEl.classList.add("red");
        btnEl.innerText = "Connect";
        btnEl.classList.remove("red-background");
        if (latencyMon) latencyMon.style.display = "none";
    }
}

function startPing() {
    stopPing();
    pingInterval = setInterval(() => {
        if (wsConn && wsConn.readyState === WebSocket.OPEN) {
            lastPingTime = performance.now();
            sendWsMsg({ type: "ping", message: "latency-check" });
        }
    }, 3000);
}

function stopPing() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

function drawWaveform() {
    if (!canvas) {
        canvas = document.getElementById("waveform-canvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw Channel A (Green)
    ctx.beginPath();
    ctx.strokeStyle = "#00ff37";
    ctx.lineWidth = 2;
    for (let i = 0; i < waveformDataA.length; i++) {
        const x = (i / (waveformDataA.length - 1)) * w;
        const y = h - (waveformDataA[i] / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Channel B (Yellowish)
    ctx.beginPath();
    ctx.strokeStyle = "#ffe99d";
    ctx.lineWidth = 2;
    for (let i = 0; i < waveformDataB.length; i++) {
        const x = (i / (waveformDataB.length - 1)) * w;
        const y = h - (waveformDataB[i] / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Shift data
    waveformDataA.push(0);
    waveformDataA.shift();
    waveformDataB.push(0);
    waveformDataB.shift();

    requestAnimationFrame(drawWaveform);
}

function updateWaveformData(channel, hexArray) {
    // Extract intensities from V3 HEX data
    // Format is pulse-A:["HEX", "HEX", ...]
    // Each HEX is 16 chars (8 bytes). Strength 4 items are bytes 4-7 or 12-15 depending on channel
    // Actually the app receiving protocol says:
    // pulse-A:[waveform data...] where each is 8 bytes HEX
    // From V3 protocol: 0xB0 + ... + A waveform strength 4 bytes + B waveform strength 4 bytes
    // Wait, the client sends pulse-A: ["HEX"...] where each HEX is the 8-byte V3 pulse data.
    // In V3, strength is 1 byte per 25ms.
    
    hexArray.forEach(hex => {
        // Simple extraction: the last 4 bytes are usually the strengths in these examples
        // or we just take the max value found in the byte sequence for visualization
        for (let i = 0; i < hex.length; i += 2) {
            const val = parseInt(hex.substr(i, 2), 16);
            if (val <= 100 && val > 0) {
                if (channel === 'A') {
                    waveformDataA[waveformDataA.length - 1] = Math.max(waveformDataA[waveformDataA.length - 1], val);
                } else {
                    waveformDataB[waveformDataB.length - 1] = Math.max(waveformDataB[waveformDataB.length - 1], val);
                }
            }
        }
    });
}

function connectWs() {
    const wsUrl = "ws://12.34.56.78:9999/";
    wsConn = new WebSocket(wsUrl);

    wsConn.onopen = function (event) {
        console.log("WebSocket connection established");
        reconnectAttempts = 0;
        updateStatusUI("Connected");
        startPing();
        drawWaveform();
    };

    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        switch (message.type) {
            case 'ping':
                const rtt = Math.round(performance.now() - lastPingTime);
                const latVal = document.getElementById("latency-value");
                if (latVal) latVal.innerText = rtt;
                break;
            case 'bind':
                if (!message.targetId) {
                    connectionId = message.clientId;
                    qrcodeImg.clear();
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#" + wsUrl + connectionId);
                } else {
                    if (message.clientId != connectionId) return;
                    targetWSId = message.targetId;
                    updateStatusUI("Connected");
                    hideqrcode();
                }
                break;
            case 'break':
                if (message.targetId != targetWSId) return;
                showToast("The other party has disconnected");
                targetWSId = "";
                updateStatusUI("Disconnected");
                showqrcode();
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
                } else if (message.message.includes("pulse-")) {
                    // Update visualizer when outgoing pulse is detected (simulated feedback)
                    const parts = message.message.split(':');
                    const channel = parts[0].replace('pulse-', '');
                    try {
                        const hexArray = JSON.parse(parts[1]);
                        updateWaveformData(channel, hexArray);
                    } catch(e) {}
                } else if (message.message.includes("feedback")) {
                    showSuccessToast(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                if (targetWSId !== '') {
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                break;
        }
    };

    wsConn.onerror = function (event) {
        updateStatusUI("Connection Error", true);
    };

    wsConn.onclose = function (event) {
        updateStatusUI("Disconnected");
        stopPing();
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            updateStatusUI(`Reconnecting (${reconnectAttempts})...`);
            setTimeout(connectWs, delay);
        } else {
            showToast("Maximum reconnection attempts reached.");
        }
    };
}

connectWs();

function sendWsMsg(messageObj) {
    if (!wsConn || wsConn.readyState !== WebSocket.OPEN) return;
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type')) messageObj.type = "msg";
    
    // Intercept pulse messages for local visualization
    if (messageObj.type === "clientMsg" && messageObj.message) {
        const channel = messageObj.channel;
        const hexStr = messageObj.message.split(':')[1];
        try {
            const hexArray = JSON.parse(hexStr);
            updateWaveformData(channel, hexArray);
        } catch(e) {}
    }
    
    wsConn.send(JSON.stringify(messageObj));
}

function addOrIncrease(type, channelIndex, strength) {
    const channelElement = document.getElementById(channelIndex === 1 ? "channel-a" : "channel-b");
    let currentValue = parseInt(channelElement.innerText);
    if (type === 3) currentValue = 0;
    else if (type === 1) currentValue = Math.max(currentValue - strength, 0);
    else if (type === 2) currentValue = Math.min(currentValue + strength, 200);
    sendWsMsg({ type, strength: currentValue, message: "set channel", channel: channelIndex });
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
    fangdouSetTimeOut = setTimeout(() => { fangdouSetTimeOut = null; }, fangdou);
}

function showToast(message) { new Notyf().error(message); }
function showSuccessToast(message) { new Notyf().success(message); }

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
        reconnectAttempts = maxReconnectAttempts; 
        wsConn.close();
        showToast("Disconnected by user");
    } else {
        reconnectAttempts = 0;
        connectWs();
    }
}