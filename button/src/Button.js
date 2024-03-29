import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';

// Sounds
import beepSound from './sounds/beep.wav';

// CSS
import 'font-awesome/css/font-awesome.min.css';
import './Button.css';

// Preload beep sound
const beep = new Audio(beepSound);
beep.load();

const Button = (props) => {
  // Admin panel items will be shown if URL path is /admin
  const adminPanel = props.location.pathname.startsWith('/admin');

  // Enable /logout path
  const history = useHistory();
  if (props.location.pathname.startsWith('/logout')) {
    localStorage.removeItem('buttonAppToken');
    history.push('/');
  }

  // State objects
  const [ password, setPassword ] = useState('');
  const [ appToken, setAppToken ] = useState(localStorage.getItem('buttonAppToken'));
  const [ apiStatus, setApiStatus ] = useState('connecting');
  const [ lastAlert, setLastAlert ] = useState(null);
  const [ connections, setConnections ] = useState(0);
  const [ alertTriggered, setAlertTriggered ] = useState(false);
  const [ alertAcknowledged, setAlertAcknowledged ] = useState(false);
  const [ lastAlertDate, setLastAlertDate ] = useState('Unknown');
  const [ pushEnabled, setPushEnabled ] = useState(window.Notification ? Notification.permission : 'unavailable');

  const connectionCheckTimeout = useRef(null);
  const lastStatusTime = useRef(null);
  const ws = useRef(null);
  const messageChannel = useRef(null);

  // useEffect for WebSocket connection test interval
  useEffect(() => {
    if (appToken === 'temp-app-token-reconnecting') return;
    if (apiStatus === 'connecting') return;

    const checkConnection = () => {
      if (connectionCheckTimeout.current) clearTimeout(connectionCheckTimeout.current);
      if (lastStatusTime.current) {
        const currentTime = (new Date()).getTime() / 1000;
        const timeDiff = (currentTime - lastStatusTime.current).toFixed(3);
        console.log(`Last Status: ${timeDiff} seconds ago`);
        if (timeDiff > 5) {
          console.log('No status update in over 5 seconds. Reconnecting...');
          setApiStatus('connecting');
          setAppToken('temp-app-token-reconnecting');
          setTimeout(() => setAppToken(appToken), 0);
        }
      }
      connectionCheckTimeout.current = setTimeout(checkConnection, 5000);
    };
    checkConnection();
  }, [ appToken, apiStatus ]);

  // useEffect for component unmounting
  useEffect(() => {
    return () => {
      if (connectionCheckTimeout.current) clearTimeout(connectionCheckTimeout.current);
    };
  }, []);

  // useEffect for connecting to WebSocket server
  useEffect(() => {
    // Skip if no appToken, already connecting, or already connected
    if (!appToken || appToken === 'temp-app-token-reconnecting') return;
    if ([0, 1].includes(ws.current?.readyState)) return;

    const wsUri = process.env.NODE_ENV === 'production'
      ? `${window.location.protocol.replace('http', 'ws')}//${window.location.host}/`
      : `${window.location.protocol.replace('http', 'ws')}//${window.location.hostname}:4000/`
    ws.current = new WebSocket(wsUri);

    ws.current.addEventListener('open', () => {
      // Authenticate
      ws.current.send(JSON.stringify({ type: 'authenticate', appToken: appToken }));
    });

    // Handle messages from server
    ws.current.addEventListener('message', (event) => {
      const message = (() => {
        try { return(JSON.parse(event.data.toString())); } catch (error) { return; }
      })();
      if (!message) return;

      if (message.type === 'status') {
        if (message.status?.status) {
          setApiStatus(message.status.status);
        }
        if (message.status?.lastTrigger) {
          setLastAlert(message.status.lastTrigger);
        }
        if (message.status?.connections) {
          setConnections(message.status.connections);
        }
        lastStatusTime.current = (new Date()).getTime() / 1000;
        return console.log('Button Status:', message.status);
      }

      if (message.type === 'result' && message.error) {
        alert(message.error);
      }

      console.log('WebSocket Message:', message);
    });

    // Reconnect on socket closure
    ws.current.addEventListener('close', () => {
      console.log('Socket connection closed. Reconnecting...');
      setApiStatus('connecting');
      setAppToken('temp-app-token-reconnecting');
      setTimeout(() => setAppToken(appToken), 0);
    });

    return () => {
      // This is causing iOS Safari to fail at re-connecting after sleep
      // ws.current.close();
    };
  }, [ appToken ]);

  // Open MessageChannel to service worker
  useEffect(() => {
    if (!navigator.serviceWorker?.controller) return;
    messageChannel.current = new MessageChannel();
    navigator.serviceWorker.controller.postMessage({
      type: 'INIT_PORT'
    }, [messageChannel.current.port2]);

    messageChannel.current.port1.onmessage = (event) => {
      console.log('event', event.data.payload);
    };

    navigator.serviceWorker.controller.postMessage({
      type: 'INCREASE_COUNT',
    });
  }, []);

  // apiLogin() -- Function to log in to API server
  const apiLogin = async () => {
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: `password=${password}`,
      });
      console.log('res.status', res.status);
      if (res.status === 401) {
        return alert('Invalid Password');
      }
      localStorage.setItem('buttonAppToken', password);
      setAppToken(password);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  // triggerAlert() -- Function to trigger an alert
  const triggerAlert = async () => {
    if (ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'command', command: 'alert' }));
    } else {
      try {
        const res = await fetch('/alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: `appToken=${appToken}`,
        });
        if (res.status === 'error') {
          alert('Unable to trigger alert!');
          return console.error(`Error: ${res.message}`);
        }
        console.log('Response:', await res.json());
      } catch (error) {
        alert('Unable to trigger alert!');
        console.error(`Error: ${error}`);
      }
    }
  };

  // acknowledgeAlert() -- Function to allow admins to acknowledge an alert
  const acknowledgeAlert = async () => {
    if (ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'command', command: 'acknowledge' }));
    } else {
      try {
        const res = await fetch('/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: `appToken=${appToken}&command=acknowledge`,
        });
        if (res.status === 'error') {
          alert('Unable to acknowledge alert!');
          return console.error(`Error: ${res.message}`);
        }
        console.log('Response:', await res.json());
      } catch (error) {
        alert('Unable to acknowledge alert!');
        console.error(`Error: ${error}`);
      }
    }
  };

  // pushRegistration() -- Function to allow admins to register for push notifications
  const pushRegistration = async (subscription) => {
    if (ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'register', subscription }));
    } else {
      try {
        const res = await fetch('/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: { appToken, subscription },
        });
        if (res.status === 'error') {
          alert('Unable to subscribe through API server!');
          return console.error(`Error: ${res.message}`);
        }
        console.log('Response:', await res.json());
      } catch (error) {
        alert('Unable to subscribe through API server!');
        console.error(`Error: ${error}`);
      }
    }
  };

  // Start API status check interval when appToken is set
  // **TODO: enable this if WS can't connect
  // useEffect(() => {
  //   // Function to poll API for current alert status
  //   const getAlertStatus = async () => {
  //     const response = await fetch('/status', { method: 'GET' });
  //     const data = await response.json();
  //     if (data.status) {
  //       setApiStatus(data.status);
  //     }
  //     if (data.lastTrigger) {
  //       setLastAlert(data.lastTrigger);
  //     }
  //   }

  //   // Check alert status every second
  //   const alertStatusInterval = setInterval(() => {
  //     getAlertStatus();
  //   }, 1000);

  //   // Clear interval when unmounted
  //   return () => clearInterval(alertStatusInterval);
  // }, [appToken]);

  // Update button state when API status has changed
  useEffect(() => {
    if (apiStatus === 'ready') {
      setAlertTriggered(false);
      setAlertAcknowledged(false);
    }
    if (apiStatus === 'triggered') {
      setAlertTriggered(true);
      setAlertAcknowledged(false);
    }
    if (apiStatus === 'acknowledged') {
      setAlertTriggered(true);
      setAlertAcknowledged(true);
    }
  }, [ apiStatus ]);

  useEffect(() => {
    const dateFormat = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    setLastAlertDate(new Date(lastAlert).toLocaleTimeString('en-US', dateFormat));
  }, [ lastAlert ]);

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    apiLogin();
  };

  // handleButtonClick(event) -- Event handler for button click
  const handleButtonClick = async () => {
    // Play sound and trigger state change for animations
    beep.play();

    if (alertTriggered) {
      // Don't re-send request if already triggered and hasn't been acknowledged
      if (!adminPanel && !alertAcknowledged) return;

      // If admin panel, acknowledge alert
      if (adminPanel && !alertAcknowledged) {
        return acknowledgeAlert();
      }
    }

    // Send request to API
    triggerAlert();
  };

  // Convert a base64 string to Uint8Array.
  // Must do this so the server can understand the VAPID_PUBLIC_KEY.
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // handlePushEnable(event) -- Event handler for enabling push notifications "button"
  const handlePushEnable = async () => {
    // Request user permission for notifications
    const userChoice = await window.Notification.requestPermission();
    if (userChoice === 'granted') {
      // Subscribe to push manager
      const registration = await navigator.serviceWorker.getRegistration();
      const subscribed = await registration.pushManager.getSubscription();
      if (subscribed) {
        console.info('User is already subscribed to push notifications.');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(process.env.REACT_APP_VAPID)
      });

      // Send subscription information to API server
      try {
        await pushRegistration(subscription);
      } catch (error) {
        console.error('Unable to add push subscription to API', error);
      }

      navigator.serviceWorker.controller.postMessage({
        type: 'ENABLE_PUSH',
      });
    }
    setPushEnabled(userChoice);
  };

  const handleTestButton = () => {
    navigator.serviceWorker.controller.postMessage({
      type: 'SERVICE_WORKER_TEST',
    });
  };

  // Return UI
  return (
    <div className="Button">
      { !appToken ? (
        <div className="Login">
          <span>Enter Password</span>
          <form id="loginform" onSubmit={handlePasswordSubmit}>
            <input id="password" value={password} onChange={handlePasswordChange} />
          </form>
        </div>
      ) : apiStatus === 'connecting'
          ? (
            <div className="connectingView">Connecting...</div>
          ) : (
            <>
              {
                adminPanel && !['granted', 'unavailable', 'denied'].includes(pushEnabled) &&
                <span id="pushEnableButton" onClick={handlePushEnable}>Enable Push Notifications</span>
              }
              {
                adminPanel && pushEnabled === 'granted' &&
                <span id="workerTestButton" onClick={handleTestButton}>Service Worker Test</span>
              }
              <header className="Button-header">
                <span className={ alertTriggered ? alertAcknowledged ? 'pulse pgreen' : 'pulse pred' : 'pulse' }>
                  <i className={ alertTriggered ? alertAcknowledged ? 'btn green' : 'btn red' : 'btn' } onClick={handleButtonClick}>
                    <i className={ alertAcknowledged ? 'fa fa-thumbs-up' : 'fa fa-bell' }></i>
                  </i>
                </span>
                { !adminPanel ? null
                  : <span className='lastAlertText'><b>Last Alert</b><br />{ lastAlert ? lastAlertDate : 'None' }</span>
                }
                { !adminPanel ? null
                  : <span className='connectionsText'><b>Connections: </b>{ connections ? connections : 0 }</span>
                }
              </header>
            </>
      )}
    </div>
  );

};

export default Button;
