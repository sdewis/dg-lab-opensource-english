## Coyote Erotic Pulse Host V2

| Service UUID | Characteristic UUID | Properties | Name | Size (BYTE) |
| :------------: | :------------: | :------------: | :------------: | :------------: |
|     0x180A     |     0x1500     |  Read/Notify   | Battery_Level  | 1 Byte          |
|     0x180B     |     0x1504     | Read/Write/Notify | PWM_AB2      | 3 Bytes         |
|     0x180B     |     0x1505     |   Read/Write   | PWM_A34        | 3 Bytes         |
|     0x180B     |     0x1506     |   Read/Write   | PWM_B34        | 3 Bytes         |

|      Name      |      Description       |  Communication Data Definition  |
| :------------: | :------------: | :------------: |
| Battery_Level  | Current device battery | 1byte (integer 0-100)|
| PWM_AB2        | Intensity of both AB channels | 23-22bit(reserved) 21-11bit(A channel actual intensity) 10-0bit(B channel actual intensity) |
| PWM_A34        | B channel waveform data | 23-20bit(reserved) 19-15bit(Az) 14-5bit(Ay) 4-0bit(Ax) |
| PWM_B34        | A channel waveform data | 23-20bit(reserved) 19-15bit(Bz) 14-5bit(By) 4-0bit(Bx) |

### Bluetooth Name

Pulse Host 2.0 : D-LAB ESTIM01

> Base UUID: 955A`xxxx`-0FE2-F5AA-A094-84B8D4F3E8AD (Replace xxxx with the service UUID)

### Basic Principles
Coyote has two independent built-in pulse generation modules, corresponding to channels A and B respectively. Each pulse generation module consists of a power supply module and a waveform control module. We control the pulse generation modules through four variables S, X, Y, and Z in the Bluetooth protocol.

### Power Supply Module (S)
> S: PWM_AB2 Characteristic

The power supply module controls the voltage of the pulse, that is, the intensity of the channel (the number in the ring in the App interface), which corresponds to the parameter S in the Bluetooth protocol. The range is [0-2047] (cannot exceed 2047). In our APP, every increment of intensity adds 7 (the actual intensity value set in the pulse host is 7 times the value displayed in the APP). When we write a different value of parameter S into the APP, the channel intensity will change immediately and be maintained.

### Waveform Control Module (X Y Z)
> X: 5bits data of 4-0bit in PWM_A34 or PWM_B34<br/>
> Y: 10bits data of 14-5 in PWM_A34 or PWM_B34<br/>
> Z: 5bits data of 19-15 in PWM_A34 or PWM_B34<br/>

The waveform control module controls the pattern of pulse occurrences and changes in pulse width. The pattern of pulse occurrences and changes in pulse width are saved in the form of built-in waveforms or custom waveforms.

### Pulse Pattern Control
The Coyote program divides each second into 1000 milliseconds, and a pulse can be generated within each millisecond. We use the two parameters X and Y in the Bluetooth protocol to encode the pattern of pulse generation, where X represents emitting X pulses continuously for X milliseconds, and Y means after X pulses, there will be an interval of Y milliseconds before emitting X pulses again, and looping. The range of X is [0-31], and the range of Y is [0-1023].

> e.g.<br/>
The parameter [1,9] means emitting 1 pulse every 9ms, taking a total of 10ms, which means the pulse frequency is 100Hz. The parameter [5,95] means emitting 5 pulses every 95ms, taking a total of 100ms. Because these five pulses are connected together and the duration is only 5ms, the user will only feel one (five-in-one) pulse, so in the user's bodily sensation, the pulse frequency is 10Hz.

### Frequency Value
```
Frequency = X + Y
Actual pulse frequency = Frequency / 1000
```
As a frequency characteristic value of the relationship between X and Y values. You can calculate the most suitable X and Y values by setting the Frequency value. Its value range is (10~1000).

The data ratio of X and Y is maintained according to the formula:
<div id="formula"><pre>
X = ((Frequency / 1000)^ 0.5) * 15
Y = Frequency - X
</pre></div>

The effect is best at this time.

If the ratio of X:Y is greater than 1:9 (e.g. [8,2]), the overall sensation of the waveform will be weakened.

### Pulse Width Control
One pulse consists of two symmetrical positive and negative unipolar pulses. The height (voltage) of the two unipolar pulses is determined by the intensity of this channel. We control the strength of the feeling brought by the pulse by controlling the pulse width. The wider the pulse, the stronger the feeling; conversely, the narrower the pulse, the weaker the feeling. The rhythmic change of the pulse width can create different pulse sensations.

The pulse width is controlled by parameter Z, and the range of Z is [0-31]. The actual pulse width is Z*5us. That is, when Z=20, the pulse width is 5*20us=100us.

- Tips: When the pulse width is greater than 100us (Z>20), the pulse is more likely to cause tingling.

### Creating Constantly Changing Waveforms
Because the parameters of the waveform are not fixed but constantly changing. Therefore, in the design of Coyote, each group of [X, Y, Z] parameters is only valid for 0.1S. That is to say, every time you write a group of [X, Y, Z] parameters to the device, the device will output the 0.1S waveform corresponding to the parameters and then stop outputting. This means if you need the waveform to maintain a frequency of 100Hz, a width of 100us, and continuous output, you need to send the parameters [1,9,20] to the device every 0.1 seconds.

- Tips: You can also change the Frequency value every 0.1 seconds and use the [Frequency Formula](#formula) to automatically generate X and Y values.

### More Examples
If you want to create a waveform whose frequency gets faster continuously, you can try sending the following data to the device in sequence every 0.1 seconds.

[5,135,20] [5,125,20] [5,115,20] [5,105,20] [5,95,20] [4,86,20] [4,76,20] [4,66,20] [3,57,20] [3,47,20] [3,37,20] [2,28,20] [2,18,20] [1,14,20] [1,9,20]

If you want to create a waveform that constantly switches between two frequencies, you can try sending the following data to the device in sequence every 0.1 seconds.

[5,95,20] [5,95,20] [5,95,20] [5,95,20] [5,95,20] [1,9,20] [1,9] [1,9,20] [1,9,20] [1,9,20]

If you want to create a waveform with a constant frequency but bringing a "thrusting" feeling, you can try sending the following data to the device in sequence every 0.1 seconds.

[1,9,4] [1,9,8] [1,9,12] [1,9,16] [1,9,18] [1,9,19] [1,9,20] [1,9,0] [1,9,0] [1,9,0]

- Tips: The human body is slow to perceive changes in frequency, so if the frequency changes too fast, it will not form a sense of rhythm. Frequent changes in pulse width, however, can create diverse sensations.