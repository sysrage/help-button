# Help Button

Web API server and React front-end for family help button.


To start the server:

1. From the 'server' directory, run:
    `npm run build`

    This will automatically install the necessary dependencies for both the client and the server as well
    as build the client React application.

2. Create a `.env` file within the 'server' directory, containing:
    ```
    ALERT_APP_TOKEN=super_secret_password
    PO_APP_TOKEN=your_pushover_application_token
    PO_APP_TARGETS=comma_separated_pushover_target_ids
    ```

    NOTE: the `ALERT_APP_TOKEN` will be used to log in and should be kept secret.

3. From the 'server' directory, run:
    `npm run start` *or* `node server.js`

4. On a client, navigate to `http://<server.ip.address>:4000` and login with `ALERT_APP_TOKEN`.

    NOTE: If the token changes on the server, navigate to `http://<server.ip.address>:4000/logout` to
    enter a new password.
