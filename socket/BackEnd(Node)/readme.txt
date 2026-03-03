0. The following code applies to a Linux server, downloading via the Node official website's Linux package manager
https://nodejs.org/en/download/package-manager

NVM installation is recommended.

Follow the command line prompts on the official website to select and install Node version 18 or above (LTS version recommended).

Copy and execute the Linux commands from the page line by line into the server, wait for the prompt to complete, check if the installed version is correct, then restart the command window or remote window.

Next, use npm to install the necessary background runtime environment:

1. npm i ws -g
Install the websocket for node plugin globally, allowing node to support the websocket protocol. If running the program using pm2 in step 6 fails later, use the cd command to enter the folder from step 6 and use npm i ws to configure the plugin specifically to this folder.

2. npm i pm2 -g
Install PM2 globally. Because node programs do not support background running natively, and using Linux's built-in background running is unreliable, it is recommended to use PM2 to host your program running in the background (supports automatic restart when the program crashes).

3. Create a folder in the directory to store the server-side code (for example: www/myws) and place the websocketNode.js file in it.

4. Use the cd command to enter your folder (for example: cd www/myws).

5. Execute the command npx pm2 start websocketNode.js to see the running prompt.
If you need to view the log printed during operation, you can enter npx pm2 log 0 in the command line in this directory and press enter to view after running the code.
(Normally, if you only have one program, the id is 0. If you run multiple programs, after executing the start command, the command line will display the id of your current task. Change the 0 at the end of the command to the corresponding id.)