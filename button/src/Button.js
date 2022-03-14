import React, { useState, useEffect } from 'react';
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
  const [ apiStatus, setApiStatus ] = useState('ready');
  const [ lastAlert, setLastAlert ] = useState(null);
  const [ alertTriggered, setAlertTriggered ] = useState(false);
  const [ alertAcknowledged, setAlertAcknowledged ] = useState(false);
  const [ lastAlertDate, setLastAlertDate ] = useState('Unknown');

  // buttonClickHandler(event) -- Event handler for button click
  const buttonClickHandler = async () => {
    // Play sound and trigger state change for animations
    beep.play();

    if (alertTriggered) {
      // Don't re-send request if already triggered and hasn't been acknowledged
      if (!adminPanel && !alertAcknowledged) return;

      // If admin panel, acknowledge alert
      if (adminPanel && !alertAcknowledged) {
        return await acknowledgeAlert();
      }
    }

    // Send request to API
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
        // Failed to trigger alert
        return alert(`Error: ${res.message}`);
      }
      console.log(await res.json());
    } catch (error) {
      return alert(`Error: ${error}`);
    }
  };

  // acknowledgeAlert() -- Function to allow admins to acknowledge an alert
  const acknowledgeAlert = async () => {
    try {
      const res = await fetch('/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: `appToken=${appToken}&command=acknowledge`,
      });
      console.log('Response:', res);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  };

  // Start API status check interval when appToken is set
  useEffect(() => {
    // Function to poll API for current alert status
    const getAlertStatus = async () => {
      const response = await fetch('/status', { method: 'GET' });
      const data = await response.json();
      if (data.status) {
        setApiStatus(data.status);
      }
      if (data.lastTrigger) {
        setLastAlert(data.lastTrigger);
      }
    }

    // Check alert status every second
    const alertStatusInterval = setInterval(() => {
      getAlertStatus();
    }, 1000);

    // Clear interval when unmounted
    return () => clearInterval(alertStatusInterval);
  }, [appToken]);


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
        </header>
      )}
    </div>
  );

};

export default Button;
