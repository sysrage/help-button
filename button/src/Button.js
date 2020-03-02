import React from 'react';

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

export default class Button extends React.Component {
  state = {
    alertTriggered: false,
    alertAcknowledged: false,
    lastAlert: null,
  };

  // Poll API for current alert status
  alertStatusInterval = null;
  getAlertStatus = () => {
    fetch('/status', {
      method: 'GET',
    })
    .then((res) => {
      return res.json();
    })
    .then((resdata) => {
      if (resdata.lastTrigger && resdata.lastTrigger !== this.state.lastAlert) {
        this.setState({lastAlert: resdata.lastTrigger});
      }

      if (resdata.status === 'ready' && (this.state.alertTriggered || this.state.alertAcknowledged)) {
        this.setState({ alertTriggered: false, alertAcknowledged: false });
      }
      if (resdata.status === 'triggered' && (!this.state.alertTriggered || this.state.alertAcknowledged)) {
        this.setState({ alertTriggered: true, alertAcknowledged: false });
      }
      if (resdata.status === 'acknowledged' && (!this.state.alertTriggered || !this.state.alertAcknowledged)) {
        this.setState({ alertTriggered: true, alertAcknowledged: true });
      }
    });
  }

  acknowledgeAlert = () => {
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

  adminPanel = this.props.location.pathname.substring(0,6) === '/admin' ? true : false;

  // Event handler for button click
  clickHandler = () => {
    // Play sound and trigger state change for animations
    beep.play();

    if (this.state.alertTriggered) {
      // Don't re-send request if already triggered and hasn't been acknowledged
      if (!this.adminPanel && !this.state.alertAcknowledged) return;

      // If admin panel, acknowledge alert
      if (this.adminPanel && !this.state.alertAcknowledged) {
        return this.acknowledgeAlert();
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

      if (resdata.status === 'triggered') {
        // Successfully triggered an alert
        this.setState({ alertTriggered: true });
      }
    });
  }

  componentDidMount = () => {
    this.getAlertStatus();
    this.alertStatusInterval = setInterval(() => {
      this.getAlertStatus();
    }, 1000);
  }


  render = () => {
    const dateFormat = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    const lastAlertDate = this.state.lastAlert ? new Date(this.state.lastAlert).toLocaleTimeString('en-US', dateFormat) : 'Unknown';
    const alertPulseStatus = this.state.alertTriggered ? this.state.alertAcknowledged ? 'pulse pgreen' : 'pulse pred' : 'pulse';
    const alertButtonStatus = this.state.alertTriggered ? this.state.alertAcknowledged ? 'btn green' : 'btn red' : 'btn';
    const alertButtonIcon = this.state.alertAcknowledged ? 'fa fa-thumbs-up' : 'fa fa-bell';
    return (
      <div className="Button">
        <header className="Button-header">
          <span className={alertPulseStatus}>
            <a href="#" className={alertButtonStatus} onClick={this.clickHandler}>
              <i className={alertButtonIcon}></i>
            </a>
          </span>
          { !this.adminPanel ? null
            : <span className='lastAlertText'><b>Last Alert</b><br />{lastAlertDate}</span>
          }
        </header>
      </div>
    );
  };

};
