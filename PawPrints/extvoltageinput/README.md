# Explanation and Usage Examples of External Voltage Detection

This document introduces the "external voltage detection trigger" function in the button accessory features, helping Coyote enthusiasts more easily expand personalised gameplay.

External voltage detection triggering is an experimental (yet to be perfected bonus feature) advanced usage, which means this function involves some professional skills. To use it smoothly and safely, you need to prepare at least the following tools: a multimeter, wires, a Type-C USB C-C connection cable, a potentiometer with a maximum resistance of about 20KΩ, and electrical insulation tape.

## Basic Introduction and Concept Explanation

The "external voltage detection trigger" function allows setting events to be triggered by an external voltage signal, implemented based on the built-in ADC button function of the main control chip. The input of the external voltage described in this article multiplexes the "CC1 pin" in the 6P Type-C interface, which is connected to the ADC through a built-in voltage divider circuit.

We detect the voltage between CC1 and GND through the ADC button function of the main control chip. The range of 0~2.1V is divided into 30 levels (0.07V resolution) with an error of ±5%. Note: when in use, avoid charging the button, pay attention to the connection polarity, and the hardware withstand voltage limit is 3.0V. Before use, please be sure to check whether the circuit wiring is connected correctly and whether the voltage and polarity meet the requirements. Improper use may cause device damage or even danger.

* Note: The ADC button is suitable for digital switching values. If used to measure analogue voltage, there will be a large error. It is strongly recommended to design it according to the switching value.

## Voltage Detection Mode Design Instructions

The voltage sensor is designed with two detection modes: "High Level" (using built-in pull-up) and "High Impedance State" (not using built-in pull-up). The default is "High Level", i.e., built-in pull-up mode.

The default "High Level" mode provides an internal pull-up level, which is connected to the external voltage detection pin (CC1) via a 10K resistor and grounded via a 4.8K resistor. When the detection port is floating and not connected, the voltage of the external voltage detection pin is about 1V. Using this mode, you only need to set a variable resistor or a switch button between the external voltage detection pin and ground to change the voltage value without a power supply. You can also choose the "High Impedance State" mode. This mode disconnects the internal pull-up. At this time, the external voltage detection pin (CC1) is only grounded via a 4.8K resistor and will not output externally. Using this mode requires you to provide a voltage source (including but not limited to silicon photocells, hand-crank generators, dry batteries) and design the circuit according to your gameplay needs, whilst also paying attention to voltage division and clamping.

After completing the circuit setup, you can set the "Target Voltage Range" and "Parameter Mapping Range" in the APP according to your gameplay needs. Depending on your gameplay, set the expected voltage range. If the actual voltage is not in the target range, it will trigger the set event, and the further the actual voltage deviates from the set range, the larger the "parameter" will be (if you have set the "Parameter Mapping Range").

## Usage Examples

Voltage signals being the most commonly used information carriers, the source of external voltage can be various sensors, and you can freely use your creative ideas to realise personalised gameplay. These sensors can be off-the-shelf products, such as: photoresistors, microphone pickups, distance measurement modules, etc.; or they can be self-made, such as: adding a small motor to a hamster treadmill, winding a spring on a potentiometer, sticking copper foil tape on a water cup, etc.

Connecting the button to the sensor uses an off-the-shelf finished Type-C USB C-C connection cable available on the market. You can choose to use a ready-made adapter or directly cut it and wire it yourself according to the actual situation. Regarding the wire sequence position of the "CC1 pin" and "GND pin", you can refer to information on the internet, such as [Type-C Hardware Interface Pin Definition](https://baike.baidu.com/item/USB%20Type-C?fromtitle=Type-C&fromid=16565336&fromModule=lemma_search-box#3). The "Demo Function Test" section below will also show the connection method from the cable to the sensor.

Please note: Because Type-C can be plugged in on both sides, one direction is connected to CC1 and the other direction is connected to CC2, so you need to pay attention to the plugging direction. Additionally: it is not recommended to distinguish the wire sequence by the core colour, as the colour depends on the manufacturer and is not fixed. A relatively simple method to find the wire: use the travel lock and ensure the button is in the travel state (the light is off and does not respond to button presses), plug the cable into the button, and use the resistance gear of a multimeter to measure the resistance value of each core to GND (usually a thick black wire) in turn. Only CC1 has a resistance of around 4.6KΩ (if you measure around 5.1KΩ, please plug it in the other direction).

Please pay attention to safety when using or making your own sensors. Before official use, please conduct a function test and safety confirmation with a potentiometer or experimental power supply.

Here are a few actual use cases for your reference.

### Demo Function Test

This example is a minimalist function demonstration, not involving specific usage. You only need to connect the cable and potentiometer to start the test, and it serves solely as a function test demonstration. It is strongly recommended that you perform a "Demo Function Test" before officially using this function to ensure the function is complete and reliable.

#### Hardware Composition and Installation

In this example, we only use the most common potentiometer component on the market and a standard Type-C USB C-C connection cable for function demonstration. For convenience of demonstration, we adopt the method of directly cutting the ready-made cable and wiring it ourselves. The materials used in this example are as shown in the photo.
![Project Structure](/PawPrints/img/img1.JPEG)
After cutting the cable, first use a multimeter and refer to the Type-C plug output end view to find "CC" and "GND", lead them out for standby, and then properly wrap the other unused wire cores.

Connect "CC" to the tap of the potentiometer and "GND" to either side of the potentiometer, insert the USB interface into the button, and the installation is complete.
![Project Structure](/PawPrints/img/img2.JPEG)

#### APP Settings

First, ensure that your button is correctly bound according to the APP guidelines, and the colour of the button's eye light is consistent with the accessory colour displayed in the APP.

Click to add accessory gameplay, and add "External Voltage Detection Trigger" at the corresponding button. The measurement mode keeps the default "High Level" (because the potentiometer requires the button to provide power, use the button's built-in pull-up). At this point, if your potentiometer is turned to the maximum resistance (20KΩ), the voltage is about 0.92V. Next, set the "Target Voltage Range" and "Parameter Mapping Range" as well as the intensity of the "Temporary Intensity Change" according to your preference. For example: "Target Voltage Range" 0.49V ~ 0.84V, "Parameter Mapping Range" 0.35V (older versions of the APP use 0 to 255 to represent, corresponding to 43), "Temporary Intensity Change" is set to "Parameter Determined" and adjust the intensity to +1 ~ +40.

![Project Structure](/PawPrints/img/img3.jpeg)

After saving the settings, start the channel output according to the APP guidelines to begin testing.

#### Effect

As the potentiometer is turned from one end to the other, the trigger state of the button will successively present: Triggered - Untriggered - Triggered changes. At the same time, the output intensity will also change from 40 to 0 and then to 40 following the gap between the actual voltage value and the set target voltage range (due to ADC measurement error, this parameter value is not continuous and has errors).

![Project Structure](/PawPrints/img/img4.jpeg)