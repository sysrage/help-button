# Help Button

Web API server and React UI front-end for family help button.


To start the server:

1. From 'server' directory, run:
    `yarn build`

2. Create a script to start the server with the correct Pushover credentials:

    Windows:
    ```batch
    @echo off
    set PO_APP_TOKEN=your_pushover_application_token
    set PO_TARGETS=comma_separated_pushover_target_ids
    cd "C:\Users\Yourname\Documents\Code\help-button\server\"
    node server.js
    ```

    Linux:
    ```bash
    cd /home/yourname/Documents/Code/help-button/server
    PO_APP_TOKEN=your_pushover_application_token PO_TARGETS=comma_separated_pushover_target_ids node server.js
    ```
