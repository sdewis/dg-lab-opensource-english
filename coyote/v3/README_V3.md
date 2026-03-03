## Coyote Erotic Pulse Host V3

### Bluetooth Characteristics

| Service UUID | Characteristic UUID | Properties | Name | Size (BYTE) | Description |
| :-------: | :-------: | :-----: | :---------: | :----------: | :--------------------------: |
|  0x180C   |  0x150A   |  Write  |    WRITE    | Max 20 bytes | All commands are input in this characteristic |
|  0x180C   |  0x150B   | Notify  |   NOTIFY    | Max 20 bytes | All response messages are returned in this characteristic |
|  0x180A   |  0x1500   | Read/Notify | READ/NOTIFY | 1 Byte | Battery information |

> Base UUID: 0000`xxxx`-0000-1000-8000-00805f9b34fb (Replace xxxx with the service/characteristic UUID)

### Bluetooth Name

Pulse Host 3.0 : 47L121000

Wireless Sensor : 47L120100

### Basic Principles

Coyote has two independent built-in pulse generation modules, corresponding to channels A and B respectively.<br />Each pulse generation module consists of two parts: channel intensity and channel waveform data.<br />The pulse generation module is controlled by six variables: channel intensity, channel intensity soft upper limit, waveform frequency, waveform intensity, frequency balance parameter 1, and frequency balance parameter 2.

### Bluetooth Commands

Unlike the V2 protocol, the data does not require big/little endian conversion.

#### B0 Command

The B0 command writes channel intensity changes and channel waveform data. The command data length is 20 bytes, written every 100ms. The data for both channels are in the same command.

```
0xB0(1byte command HEAD) + serial number(4bits) + intensity value reading method(4bits) + A channel intensity setting value(1byte) + B channel intensity setting value(1byte) + A channel waveform frequency 4 items(4bytes) + A channel waveform intensity 4 items(4bytes) + B channel waveform frequency 4 items(4bytes) + B channel waveform intensity 4 items(4bytes)
```

##### Serial Number

Serial number range (0b0000 \~ 0b1111). If the input data modifies the channel intensity of the pulse host, set the serial number > 0. The pulse host will return the modified channel intensity from characteristic 0x150B via a B1 response message with the same serial number. If you do not need the pulse host to feed back the channel intensity, just set the serial number to 0b0000.
In addition, to avoid problems, when modifying the channel intensity through the B0 command and the serial number is not 0, it is recommended to wait for 150B to return B1 with the same serial number message before modifying the channel intensity again.

##### Intensity Value Reading Method

The 4 bits of the intensity value reading method are divided into two parts: the high two bits represent the reading method for channel A, and the low two bits represent the reading method for channel B.<br />Reading methods:<br />0b00 -> Represents no change in the corresponding channel intensity. Whatever the intensity setting value of the corresponding channel is, it is invalid.<br />0b01 -> Represents a relative increase in the corresponding channel intensity. If the channel A intensity setting value is 15 (decimal), then the channel A intensity increases by 15.<br />0b10 -> Represents a relative decrease in the corresponding channel intensity. If the channel A intensity setting value is 17 (decimal), then the channel A intensity decreases by 17.<br />0b11 -> Represents an absolute change in the corresponding channel intensity. If the channel A intensity setting value is 32, then the channel A intensity is set to 32.

> e.g.<br />Suppose the current A channel intensity of the pulse host is 10, and B channel intensity is 10.<br />1. Intensity value reading method=0b0000, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 10, B channel intensity = 10.<br />2. Intensity value reading method=0b0100, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 15, B channel intensity = 10.<br />3. Intensity value reading method=0b0010, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 10, B channel intensity = 2.<br />4. Intensity value reading method=0b0011, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 10, B channel intensity = 8.<br />5. Intensity value reading method=0b0110, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 15, B channel intensity = 2.<br />6. Intensity value reading method=0b1101, A channel intensity setting value=5, B channel intensity setting value=8. After the B0 command is input, the pulse host's A channel intensity = 5, B channel intensity = 18.

##### Channel Intensity Setting Value

The channel intensity setting value length is 1 byte, and the valid value range is (0 ~ 200). Values outside the input range are treated as 0. The absolute range of intensity for each channel of the Coyote host is also (0 ~ 200).

> e.g.<br />Suppose the current A channel intensity of the pulse host is 10.<br />1. Intensity value reading method=0b0100, A channel intensity setting value=195. After the B0 command is input, the pulse host's A channel intensity = 200.<br />2. Intensity value reading method=0b1000, A channel intensity setting value=20. After the B0 command is input, the pulse host's A channel intensity = 0.<br />3. Intensity value reading method=0b0100, A channel intensity setting value=201. After the B0 command is input, the pulse host's A channel intensity = 10.<br />4. Intensity value reading method=0b1100, A channel intensity setting value=201. After the B0 command is input, the pulse host's A channel intensity = 0.

##### Channel Waveform Frequency / Channel Waveform Intensity

The channel waveform frequency length is 1 byte, value range (10 ~ 240); the channel waveform intensity is 1 byte, value range (0 ~ 100).
In the B0 command, 4 groups of waveform frequencies and waveform intensities for each of the two channels must be sent every 100ms. Each group of frequency-intensity represents 25ms of waveform output, and 4 groups of data represent 100ms of data.
In the waveform data, if the input value of a certain channel is not within the valid range, the pulse host will discard all 4 groups of data for that channel.

Additionally, for the channel waveform frequency, you can limit the value range to (10 ~ 1000) in your program, and then convert it to the channel waveform frequency to be sent through the following algorithm:

```
Input value range (10 ~ 1000)
Waveform frequency = when(input value){
    in 10..100 -> {
        input value
    }
    in 101..600 -> {
        (input value - 100)/5 + 100
    }
    in 601..1000 -> {
        (input value - 600)/10 + 200
    }
    else -> {
        10
    }
}
```

> e.g.<br />Take the A channel waveform data as an example.<br />1. Waveform frequency 4 items={10,10,20,30}, waveform intensity={0,5,10,50}. After the B0 command is input, the A channel normally outputs the waveform.<br />2. Waveform frequency 4 items={10,10,20,30}, waveform intensity={0,5,10,101}. After the B0 command is input, the A channel discards all 4 groups of data and does not output the waveform.

- Tips: If you currently only want to output a waveform to a single channel, input at least one invalid data item (a waveform intensity value greater than 100) into the data of the other channel, as shown in the e.g. above.

#### BF Command

> ### 🚨 The BF command takes effect immediately after being written and has no return value, so the BF command must be rewritten to set the soft upper limit every time the device is reconnected to prevent an unexpected soft upper limit value. 🚨

The BF command writes the pulse host's channel intensity soft upper limit + waveform frequency balance parameter + waveform intensity balance parameter. The command data length is 7 bytes.

```
0xBF(1byte command HEAD) + AB two-channel intensity soft upper limit(2bytes) + AB two-channel waveform frequency balance parameter(2bytes) + AB two-channel waveform intensity balance parameter(2bytes)
```

##### Channel Intensity Soft Upper Limit

The channel intensity soft upper limit can restrict the maximum value the pulse host channel intensity can reach, and this setting is saved upon power off. The value range is (0 ~ 200). Values outside the input range will not modify the soft upper limit.
Assuming the AB channel soft upper limits are set to 150 and 30, no matter how the intensity is modified via the scroll wheel or the B0 command, the channel intensity of A channel will only be in the range (0 ~ 150), and B channel will only be in the range (0 \~ 30). The pulse host's channel intensity will definitely not exceed the soft upper limit.

##### Frequency Balance Parameter 1

The waveform frequency balance parameter adjusts the sensation of high and low frequencies of the waveform, and this setting is saved upon power off. Value range (0 \~ 255).
This parameter controls the relative bodily sensation intensity of different frequency waveforms at a fixed channel intensity. The larger the value, the stronger the impact of the low-frequency waveform.

##### Frequency Balance Parameter 2

The waveform intensity balance parameter adjusts the waveform pulse width, and this setting is saved upon power off. Value range (0 \~ 255).
This parameter controls the relative bodily sensation intensity of different frequency waveforms at a fixed channel intensity. The larger the value, the stronger the stimulation of the low-frequency waveform.

### Bluetooth Response Messages

All data callbacks of the pulse host are returned through the Notify characteristic of 0x180C->0x150B. Please bind notify to this characteristic after successfully connecting to the pulse host.

#### B1 Message

When the pulse host intensity changes, the current intensity value will be returned immediately through the B1 message. If the intensity change is caused by a B0 command, the serial number in the returned B1 command will be the same as the serial number included in the command that caused the change; otherwise, the serial number is 0.

```
0xB1(1byte command HEAD) + serial number(1byte) + A channel current actual intensity(1byte) + B channel current actual intensity(1byte)
```

#### BE Message (Deprecated)

### More Examples

In summary, unlike the channel intensity/waveform data of V2, both the two-channel intensity and two-channel waveform data of V3 are integrated into this single B0 command. Here are some examples:

> Data = Command HEAD + Serial Number + Intensity Value Reading Method + A Channel Intensity Setting Value + B Channel Intensity Setting Value + A Channel Waveform Frequency{x,x,x,x} + A Channel Waveform Intensity{x,x,x,x} + B Channel Waveform Frequency{x,x,x,x} + B Channel Waveform Intensity{x,x,x,x}

No.1 Do not modify the channel intensity, A channel outputs waveform continuously:<br/>
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000000A0A0A0A000A141E0000000000000065)<br/>
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000000F0F0F0F28323C460000000000000065)<br/>
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000001E1E1E1E505A64640000000000000065)<br/>
4-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB0000000283C5064645A5A5A0000000000000065)<br/>
...<br/>

No.2 Pulse host current A channel intensity=10, A channel outputs waveform continuously:<br/>
1-> 0xB0+0b0000+0b0100+5+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00405000A0A0A0A000A141E0000000000000065)<br/>
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000000F0F0F0F28323C460000000000000065)<br/>
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000001E1E1E1E505A64640000000000000065)<br/>
4-> 0xB0+0b0001+0b0100+10+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB0140A00283C5064645A5A5A0000000000000065)<br/>
...<br/>
In 1, A channel intensity is set to +5. After setting, the pulse host A channel intensity will +5, making the pulse host channel intensity 15, but it will not return the modified channel intensity through 150B because the serial number=0.<br/>
In 4, A channel intensity is set to +10. After setting, the pulse host A channel intensity will +10, making the pulse host channel intensity 25, and it returns A channel intensity = 25 through 150B, serial number = 1.<br/>

No.3 Pulse host current A channel intensity=10, A channel outputs waveform continuously:<br/>
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000000A0A0A0A000A141E0000000000000065)<br/>
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000000F0F0F0F28323C460000000000000065)<br/>
3-> Flick the A channel scroll wheel upwards once and release.<br/>
4-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB00000001E1E1E1E505A64640000000000000065)<br/>
5-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}<br/>(HEX:0xB0000000283C5064645A5A5A0000000000000065)<br/>
...<br/>
In 3, flick the A channel scroll wheel upwards once and release. The pulse host A channel intensity will +1, and it returns A channel intensity = 11 through 150B, serial number = 0.<br/>

No.4 Do not modify the channel intensity, both AB channels output waveforms continuously:<br/>
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{10,10,10,10}+{0,0,0,0}<br/>(HEX:0xB00000000A0A0A0A000A141E0A0A0A0A00000000)<br/>
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{10,10,10,10}+{10,10,10,10}<br/>(HEX:0xB00000000F0F0F0F28323C460A0A0A0A0A0A0A0A)<br/>
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{10,10,10,10}+{0,0,0,10}<br/>(HEX:0xB00000001E1E1E1E505A64640A0A0A0A0000000A)<br/>
4-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{0,90,90,90}+{10,10,10,10}+{0,0,0,10}<br/>(HEX:0xB0000000283C5064005A5A5A0A0A0A0A0000000A)<br/>
...

Example regarding serial number and intensity input (taking channel A as an example):

```
isInputAllowed = true (whether intensity input is currently allowed)
accumulatedStrengthValueA = 0 (cumulative intensity change value not yet written to channel A)
deviceStrengthValueA = 0 (current A channel intensity value of the pulse host)
orderNo = 0 (serial number)
inputOrderNo = 0 (serial number written by B0)
strengthParsingMethod = 0b0000 (intensity value reading method)
strengthSettingValueA = 0 (A channel intensity setting value)

Function for processing A channel intensity related data
fun strengthDataProcessingA():Unit{
    if(isInputAllowed == true) {
         strengthParsingMethod = if(accumulatedStrengthValueA > 0){
             0b0100
         }else if(accumulatedStrengthValueA < 0){
             0b1000
         }else{
             0b0000
         }
         orderNo += 1
         inputOrderNo = orderNo
         isInputAllowed = false
         strengthSettingValueA = abs(accumulatedStrengthValueA) (take absolute value)
         accumulatedStrengthValueA = 0
     }else{
         orderNo = 0
         strengthParsingMethod = 0b0000
         strengthSettingValueA = 0
     }
}
Function for processing A channel intensity response message
fun strengthDataCallback(returnOrderNo : Int,returnStrengthValueA : Int):Unit{
    //returnOrderNo returns the input serial number
    //returnStrengthValueA returns the current A channel intensity of the pulse host

    deviceStrengthValueA = returnStrengthValueA
    if(returnOrderNo == inputNo){
         isInputAllowed = true
         strengthParsingMethod = 0b0000
         strengthSettingValueA = 0
         inputOrderNo = 0
     }
}
Set A channel intensity to 0
fun strengthZero():Unit{
    strengthParsingMethod = 0b1100
    strengthSettingValueA = 0
    orderNo = 1
    inputOrderNo = orderNo
}
```

The following sequence is in chronological order, but the serial number does not represent a specific moment:<br/>

```
1 -> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
2 -> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0001) + strengthParsingMethod(0b0100) + strengthSettingValueA(1) + ......)
3 -> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0000) + strengthParsingMethod(0b0000) + strengthSettingValueA(1) + ......)
3 -> 150B returns A channel intensity value
     BLE NOTIFY 150B(0xB1 + returnOrderNo(1) + returnStrengthValueA(1) + ......)
     Returned serial number = 1, returned A channel intensity = 1
     strengthDataCallback(1,1)
4 -> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
5 -> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 2)
6 -> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 3)
7 -> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0001) + strengthParsingMethod(0b0100) + strengthSettingValueA(3) + ......)
8 -> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
9 -> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0000) + strengthParsingMethod(0b0000) + strengthSettingValueA(0) + ......)
10-> 150B returns A channel intensity value
     BLE NOTIFY 150B(0xB1 + returnOrderNo(1) + returnStrengthValueA(4) + ......)
     Returned serial number = 1, returned A channel intensity = 4
     strengthDataCallback(1,4)
11-> Press the A channel intensity '+' button
     accumulatedStrengthValueA += 1 (value = 2)
12-> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0001) + strengthParsingMethod(0b0100) + strengthSettingValueA(2) + ......)
13-> Press the A channel intensity '-' button
     accumulatedStrengthValueA -= 1 (value = -1)
14-> 150B returns A channel intensity value
     BLE NOTIFY 150B(0xB1 + returnOrderNo(1) + returnStrengthValueA(6) + ......)
     Returned serial number = 1, returned A channel intensity = 6
     strengthDataCallback(1,6)
15-> (100ms cycle) B0 prepares to write
     strengthDataProcessingA()
     BLE WRITE 150A(0xB0 + orderNo(0b0010) + strengthParsingMethod(0b1000) + strengthSettingValueA(1) + ......)
16-> 150B returns A channel intensity value
     BLE NOTIFY 150B(0xB1 + returnOrderNo(2) + returnStrengthValueA(5) + ......)
     Returned serial number = 2, returned A channel intensity = 5
     strengthDataCallback(1,5)
17-> (100ms cycle) B0 prepares to write
     strengthZero()
     BLE WRITE 150A(0xB0 + orderNo(0b0001) + strengthParsingMethod(0b1100) + strengthSettingValueA(0) + ......)
18-> 150B returns A channel intensity value
     BLE NOTIFY 150B(0xB1 + returnOrderNo(1) + returnStrengthValueA(0) + ......)
     Returned serial number = 1, returned A channel intensity = 0
     strengthDataCallback(1,0)
......
```