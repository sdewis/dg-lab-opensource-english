## Coyote Pulse Waveform

In this article, we will provide some explanations regarding the waveform protocol of the Coyote pulse host, helping Coyote enthusiasts better understand the data principles of pulse waveforms.

### Concept Explanation

#### Waveform Frequency

The Coyote program divides each second into 1000 milliseconds, and a pulse can be generated within each millisecond. We encode the rules of pulse generation by controlling pulses and intervals.

The waveform frequency represents the duration of an output unit (an output unit consists of X pulses and Y intervals), in ms.

Therefore, if you want to output a 1Hz waveform, the actual waveform frequency = 1000ms; if you output a 50Hz waveform, the waveform frequency = 20ms.

| Pulse Frequency | Waveform Frequency |
|:------:|:------:|
|  1Hz   | 1000ms |
|  5Hz   | 200ms  |
|  10Hz  | 100ms  |
|  50Hz  |  20ms  |
| 100Hz  |  10ms  |
| 500Hz  |  2ms   |
| 1000Hz |  1ms   |

In the Coyote V2 protocol, the waveform frequency is jointly determined by [X and Y](/coyote/v2/README_V2.md), where X represents emitting X pulses continuously for X milliseconds, and Y means after X pulses, there will be an interval of Y milliseconds before emitting X pulses again, and looping.

> e.g.<br/>
The parameter [1,9] means emitting 1 pulse every 9ms, taking a total of 10ms, which means the pulse frequency is 100Hz, and the waveform frequency is 10ms. The parameter [5,95] means emitting 5 pulses every 95ms, taking a total of 100ms. Because these five pulses are connected together and the duration is only 5ms, the user will only feel one (five-in-one) pulse, so in the user's bodily sensation, the pulse frequency is 10Hz, and the waveform frequency is 100ms.

In the Coyote V3 protocol, we only provide the input of the waveform frequency value, and the allocation of pulses (X) and intervals (Y) in the waveform frequency is determined by the [Frequency Balance Parameter 1](/coyote/v3/README_V3.md) in the V3 protocol.

In the V3 protocol, the input of the waveform frequency also needs to undergo a compression conversion. If the user wants the waveform frequency to change linearly, please refer to the following example.

>e.g. 1<br/>1. Determine the pulse frequencies to be changed linearly, for example: 1Hz, 2Hz, 3Hz, 4Hz, 5Hz, 6Hz, 7Hz, 8Hz, 9Hz, 10Hz<br/>2. Convert to waveform frequency values: 1000ms, 500ms, 333ms, 250ms, 200ms, 166ms, 142ms, 125ms, 111ms, 100ms<br/>3. According to the conversion formula of the V3 protocol, convert the waveform frequency to the actual input value: 240, 180, 146, 130, 120, 113, 108, 105, 102, 100<br/>4. According to the protocol, input to the device in groups of 4 every 100ms, padding with 0s if insufficient.

>e.g. 2<br/>1. Determine the waveform frequency values to be changed linearly, for example: 100ms, 200ms, 300ms, 400ms, 500ms, 600ms, 700ms, 800ms, 900ms, 1000ms<br/>2. According to the conversion consensus of the V3 protocol, convert the waveform frequency to the actual input value: 100, 120, 140, 160, 180, 200, 210, 220, 230, 240<br/>3. According to the protocol, input to the device in groups of 4 every 100ms, padding with 0s if insufficient.

#### Conversion between Waveform Frequency and Actual Input Value

Since the human body is not sensitive to slight changes in frequency, the larger the waveform frequency (output unit), the more subtle the change in pulse frequency corresponding to the change in waveform frequency (output unit duration). In addition, this conversion can compress the data length, allowing interaction with shorter data.

| Waveform Frequency | Output Value | Pulse Frequency |
|:-----:|:---:|:------:|
| 10ms  | 10  | 100Hz  |
| 20ms  | 20  |  50Hz  |
| 50ms  | 50  |  20Hz  |
| 100ms | 100 |  10Hz  |
| 110ms | 102 |  9Hz   |
| 150ms | 110 | 6.6Hz  |
| 650ms | 204 | 1.53Hz |
| 680ms | 208 | 1.47Hz |
| 750ms | 215 | 1.33Hz |

#### Waveform Intensity

One pulse consists of two symmetrical positive and negative unipolar pulses. The height (voltage) of the two unipolar pulses is determined by the intensity of this channel. We control the strength of the feeling brought by the pulse by controlling the pulse width. The wider the pulse, the stronger the feeling; conversely, the narrower the pulse, the weaker the feeling. The rhythmic change of the pulse width can create different pulse sensations.

In the Coyote V2 protocol, the waveform intensity is determined by [Z](/coyote/v2/README_V2.md). The value range of the official APP is (0 ~ 20). The waveform intensity is a relative value, so there is no actual unit to represent it.

In the Coyote V3 protocol, the value range of the waveform intensity is (0 ~ 100). The waveform intensity is a relative value, so there is no actual unit to represent it.

Mapping relationship between V2 waveform intensity and V3 waveform intensity: (Waveform Intensity 20 in V2 Protocol) ≈ (Waveform Intensity 100 in V3 Protocol)

### Output Window

The output window of the V2 protocol is 100ms, and the output window of the V3 protocol is 25ms, but each time the set data is 4 groups, so it can still be considered as 100ms.

Many people are confused about the conflict between the waveform frequency value and the output window value. If the duration of the waveform frequency is greater than the output window, how will the device process the data input in the next cycle?

Our device has a relatively complex set of processing methods internally for this situation. The processing details are not described for now, but a few suggestions are given:

1. If you want to stably output a certain waveform frequency, it is recommended to stably input the value of that waveform frequency.
2. If the waveform frequency value is greater than the output window, and the input waveform frequency changes in the next cycle, then the actual output pulse may not be the effect corresponding to the input value, but the effect after complex processing.

### Conversion of V2 Protocol Waveform to V3 Protocol Waveform

V3 Waveform Frequency = After V2 (X + Y), execute the conversion of (10 ~ 1000) -> (10 ~ 240)

V3 Waveform Intensity = V2 (Z * 5)