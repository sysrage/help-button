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

  const connectionCheckTimeout = useRef(null);
  const lastStatusTime = useRef(null);
  const ws = useRef(null);

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

    ws.current = new WebSocket(`ws://${window.location.hostname}:4080/`);

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

  // buttonClickHandler(event) -- Event handler for button click
  const buttonClickHandler = async () => {
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
            <header className="Button-header">
              <span className={ alertTriggered ? alertAcknowledged ? 'pulse pgreen' : 'pulse pred' : 'pulse' }>
                <i className={ alertTriggered ? alertAcknowledged ? 'btn green' : 'btn red' : 'btn' } onClick={ buttonClickHandler }>
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
      )}
    </div>
  );

};

export default Button;
