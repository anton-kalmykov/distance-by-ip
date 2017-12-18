import React from 'react';
import ReactDOM from 'react-dom';
import {ApolloClient} from 'apollo-client';
import {HttpLink} from 'apollo-link-http';
import {InMemoryCache} from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import './index.css';

const GoogleMapsLoader = require('google-maps');
GoogleMapsLoader.KEY = 'AIzaSyBWziDqO4ZVkri1tTbTZrClQU8RfP8MRIE';

GoogleMapsLoader.load(function (google) {
    class Main extends React.Component {
        constructor(props) {
            super(props);
            this.state = this.getInitialState();
            this.gelocClient = new ApolloClient({
                link: new HttpLink({ uri: 'https://api.graphloc.com/graphql' }),
                cache: new InMemoryCache()
            });
        }

        getInitialState() {
            return {
                showForm: true,
                showResults: false,
                geos: Array(2).fill(null),
                results: {
                    origin: null,
                    destination: null,
                    duration: null
                }
            };
        }

        handleSearchAgainClick() {
            this.setState(this.getInitialState());
        }

        setGeo(n, data) {
            const geos = this.state.geos;

            geos[ n ] = data;
            this.setState({ geos: geos });
        }

        getGeolocQuery(ip) {
            return {
                query: gql`{
                  getLocation(ip: "${ip}") {
                    country {
                      names {
                        en
                      }
                    }
                    city {
                      names {
                        en
                      }
                    }
                    location {
                      latitude
                      longitude
                    }
                    postal {
                      code
                    }
                  }
                }`
            };
        }

        handleFormSubmit(addresses) {
            this.gelocClient.query(this.getGeolocQuery(addresses[ 0 ]))
                .then(response => this.setGeo(0, response.data.getLocation))
                .then(() => this.gelocClient.query(this.getGeolocQuery(addresses[ 1 ])))
                .then(response => this.setGeo(1, response.data.getLocation))
                .then(() => {
                    if (!this.state.geos.every(geo => geo)) {
                        this.setState({
                            showResults: true,
                            showForm: false
                        });
                        
                        return;
                    }

                    const origLocation = this.state.geos[ 0 ].location;
                    const destLocation = this.state.geos[ 1 ].location;
                    const origin = new google.maps.LatLng(origLocation.latitude, origLocation.longitude);
                    const destination = new google.maps.LatLng(destLocation.latitude, destLocation.longitude);
                    const service = new google.maps.DistanceMatrixService();

                    service.getDistanceMatrix({
                            origins: [ origin ],
                            destinations: [ destination ],
                            travelMode: 'DRIVING',
                            unitSystem: google.maps.UnitSystem.METRIC,
                            avoidHighways: false,
                            avoidTolls: false
                        }, response => {
                            const elem = response.rows[ 0 ].elements.find(el => el.status === 'OK');

                            if (elem) {
                                this.setState({
                                    showResults: true,
                                    showForm: false,
                                    results: {
                                        origin: response.originAddresses[ 0 ],
                                        destination: response.destinationAddresses[ 0 ],
                                        duration: elem.duration.text
                                    }
                                });
                            }
                            else {
                                this.setState({
                                    showResults: true,
                                    showForm: false
                                });
                            }
                        });
                });
        }

        render() {
            const origin = this.state.results.origin;
            const destination = this.state.results.destination;
            const duration = this.state.results.duration;

            return (
                <div>
                    <header>How long is the drive?</header>
                    {this.state.showForm ? <Form onSubmit={this.handleFormSubmit.bind(this)}/> : null}
                    {this.state.showResults ? <Results origin={origin}
                                                       destination={destination}
                                                       duration={duration}
                                                       goBack={this.handleSearchAgainClick.bind(this)}
                    /> : null}
                </div>
            );
        }
    }

    class Form extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                addresses: Array(2).fill(null),
                isValid: false
            };
        }

        validate() {
            const isValid = this.state.addresses.every(addr => {
                if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) {
                    return addr.split('.').every(octet => octet <= 255);
                }

                return false;
            });

            this.setState({
                isValid: isValid
            });
        }

        setIpAddr(n, e) {
            const addresses = this.state.addresses;

            addresses[ n ] = e.currentTarget.value;
            this.setState({ addresses: addresses });
            this.validate();
        }

        handleSendClick(e) {
            e.preventDefault();

            if (!this.state.isValid) {
                return;
            }

            this.props.onSubmit(this.state.addresses);
        }

        render() {
            return (
                <form>
                    <label htmlFor="ip_1">Give us your origin:</label>
                    <IpInput id="ip_1" onChange={this.setIpAddr.bind(this, 0)}/>
                    <br/>
                    <br/>
                    <label htmlFor="ip_2">Give us your destination:</label>
                    <IpInput id="ip_2" onChange={this.setIpAddr.bind(this, 1)}/>
                    <br/>
                    <br/>
                    <button disabled={!this.state.isValid} 
                            onClick={this.handleSendClick.bind(this)}>Gimme the distance!</button>
                </form>
            );
        }
    }

    class Results extends React.Component {
        render() {
            let element = null;

            if (this.props.duration) {
                element =   <div>
                                <b>Origin (Where are you leaving from?):</b>
                                <div>{this.props.origin}</div>
                                <br/>
                                <b>Destination (Where are you going?)</b>
                                <div>{this.props.destination}</div>
                                <hr/>
                                <div className="duration">{this.props.duration}</div>
                            </div>
            }
            else {
                element = <div>Unfortunately there is no driving route between origin and destination.</div>
            }
            return (
                <div>
                    {element}
                    <hr/>
                    <div className="search-again">
                        <a onClick={this.props.goBack}>Search again?</a>
                    </div>
                </div>
            );
        }
    }

    class IpInput extends React.Component {
        allowedKeyCodes = {
            0: 48,
            1: 49,
            2: 50,
            3: 51,
            4: 52,
            5: 53,
            6: 54,
            7: 55,
            8: 56,
            9: 57,
            arrowLeft: 37,
            arrowRight: 39,
            backspace: 8,
            dot: 190
        };

        handleKeyDown(e) {
            if (Object.values(this.allowedKeyCodes).indexOf(e.keyCode) === -1) {
                e.preventDefault();
            }
        }

        render() {
            return (
                <input type="text"
                       required="required"
                       id={this.props.id}
                       onKeyDownCapture={this.handleKeyDown.bind(this)}
                       onChange={this.props.onChange}/>
            );
        }
    }


// ========================================

    ReactDOM.render(
        <Main/>,
        document.getElementById('root')
    );
});