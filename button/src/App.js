import React from 'react';

// Sounds
import beepSound from './sounds/beep.wav';

// CSS
import 'font-awesome/css/font-awesome.min.css';
import './App.css';

// Set a super secret API key -- eventually obtained via login
const alertAppToken = 'top_secret_alert_token';

// Preload beep sound
const beep = new Audio(beepSound);
beep.load();

export default class App extends React.Component {
  state = {
    alertTriggered: false,
  };

  // Event handler for button click
  clickHandler = () => {
    // Play sound and trigger state change for animations
    beep.play();

    // Don't re-send request if already triggered
    if (this.state.alertTriggered) return;

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
      console.log('resdata', resdata);
      if (resdata.status === 'error') {
        // Failed to trigger alert
        return alert(`Error: ${resdata.message}`);
      }

      if (resdata.status === 'triggered') {
        // Successfully triggered an alert
        this.setState({ alertTriggered: true });
      }
    });
  }

  render = () => {
    return (
      <div className="App">
        <header className="App-header">
          <span className={this.state.alertTriggered ? 'pulse' : 'pulseDisabled'}>
            <a href="#" className="btn" onClick={this.clickHandler}>
              <i className="fa fa-bell"></i>
            </a>
          </span>
        </header>
      </div>
    );
  };

};
