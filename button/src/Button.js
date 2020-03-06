import React, { useState, useEffect } from 'react';

// Sounds
import beepSound from './sounds/beep.wav';

// CSS
import 'font-awesome/css/font-awesome.min.css';
import './Button.css';

// Set a super secret API key -- eventually obtained via login
const alertAppToken = 'top_secret_alert_token';

// Preload beep sound
const beep = new Audio(beepSound);
beep.load();

const Button = (props) => {
  // Admin panel items will be shown if URL path is /admin
  const adminPanel = props.location.pathname.substring(0,6) === '/admin' ? true : false;

  // acknowledgeAlert() -- Function to allow admins to acknowledge an alert
  const acknowledgeAlert = () => {
    fetch('/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `appToken=${alertAppToken}&command=acknowledge`,
    })
    .then((res) => {
      return res.json();
    })
    .then((resdata) => {
      console.log('resdata',resdata);
    });
  }

  // buttonClickHandler(event) -- Event handler for button click
  const buttonClickHandler = () => {
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
    fetch('/alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `appToken=${alertAppToken}`,
    })
    .then((res) => {
      return res.json();
    })
    .then((resdata) => {
      if (resdata.status === 'error') {
        // Failed to trigger alert
        return alert(`Error: ${resdata.message}`);
      }
    });
  }
  

  // State for current API status 
  const [ apiStatus, setApiStatus ] = useState('ready');
  const [ lastAlert, setLastAlert ] = useState(null);

  // Start API status check interval when component mounts
  useEffect(() => {
    // Function to poll API for current alert status
    const getAlertStatus = async () => {
      const response = await fetch('/status', { method: 'GET' });
      const resdata = await response.json();
      if (resdata.status) {
        setApiStatus(resdata.status);
      }
      if (resdata.lastTrigger) {
        setLastAlert(resdata.lastTrigger);
      }
    }

    // Check alert status every second
    const alertStatusInterval = setInterval(() => {
      getAlertStatus();
    }, 1000);

    // Clear interval when unmounted
    return () => clearInterval(alertStatusInterval);
  }, []);


  // State for current UI status
  const [ alertTriggered, setAlertTriggered ] = useState(false);
  const [ alertAcknowledged, setAlertAcknowledged ] = useState(false);
  const [ lastAlertDate, setLastAlertDate ] = useState('Unknown');

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

  
  // Return UI
  return (
    <div className="Button">
      <header className="Button-header">
        <span className={ alertTriggered ? alertAcknowledged ? 'pulse pgreen' : 'pulse pred' : 'pulse' }>
          <a href="#" className={ alertTriggered ? alertAcknowledged ? 'btn green' : 'btn red' : 'btn' } onClick={ buttonClickHandler }>
            <i className={ alertAcknowledged ? 'fa fa-thumbs-up' : 'fa fa-bell' }></i>
          </a>
        </span>
        { !adminPanel ? null
          : <span className='lastAlertText'><b>Last Alert</b><br />{ lastAlertDate }</span>
        }
      </header>
    </div>
  );

};

export default Button;
