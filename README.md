# Help Button

Web API server and React front-end for family help button.


## Running

To start the server:

1. From the 'server' directory, run:
    `npm run build`

    This will automatically install the necessary dependencies for both the client and the server as well
    as build the client React application.

2. Create a `.env` file within the 'server' directory, containing:
    ```
    ALERT_APP_TOKEN="super_secret_password"
    PO_APP_TOKEN="pushover_application_token"
    PO_APP_TARGETS="comma,separated,pushover,target,ids"
    ```

    NOTE: the `ALERT_APP_TOKEN` will be used to log in and should be kept secret.

3. From the 'server' directory, run:
    `npm run start` *or* `node server.js`

4. On a client, navigate to `http://<server.ip.address>:4000` and login with `ALERT_APP_TOKEN`.
    - This token/password will be saved to localStorage and should only be needed once.
    - If the token changes on the server, navigate to `http://<server.ip.address>:4000/logout` to enter a new password.
    - Use the iOS share button "Add to Home Screen" to use the button as a PWA.

## Usage

Push the button to trigger an alert. This will repeatedly send Pushover notices, until the alert has been acknowledged.

To acknowledge the alert:
- Navigate to `http://<server.ip.address>:4000/admin` and push the red bell button.
- Send a POST request to `http://<server.ip.address>:4000/admin` with the content-type `application/x-www-form-urlencoded`
  and data: `appToken=super_secret_password&command=acknowledge`.

Acknowledging the alert will change the red bell to a green thumbs-up icon, letting the original button-pusher know the
alert has been received.

After 2 minutes, the green thumbs-up icon will revert back to the grey bell. If either the grey bell or the green thumbs-up
are pushed, a new alert will be triggered.
