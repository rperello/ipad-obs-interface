import m from 'mithril';
import { ObsClient, ObsClientEvent, ConnectionState, DEFAULT_OBS_PORT } from './lib/ObsClient';

const CONNECTION_DETAILS_KEY = 'connection-details';

export class ObsControl {
    /**
     * @type {ObsClient}
     */
    #obsClient;

    #connectionDetails = {
        hostname: window.location.hostname,
        port: DEFAULT_OBS_PORT,
        password: import.meta.env.VITE_OBS_PASSWORD
    };

    #connecting = false;
    #connected = false;

    #scenes = [];
    #currentProgramSceneName = null;

    constructor() {
        this.onConnectionStateChanged = this.#onConnectionStateChanged.bind(this);
        this.onCurrentProgramSceneChanged = this.#onCurrentProgramSceneChanged.bind(this);
    }

    async oninit() {
        this.#getConnectionDetailsFromPersistence();
        void this.#initiateConnection();
    }

    #getConnectionDetailsFromPersistence() {
        const connectionDetails = localStorage.getItem(CONNECTION_DETAILS_KEY);

        if (connectionDetails == null) {
            return;
        }

        this.#connectionDetails = JSON.parse(connectionDetails);
    }

    #persistConnectionDetails() {
        const connectionDetails = JSON.stringify(this.#connectionDetails);

        localStorage.setItem(CONNECTION_DETAILS_KEY, connectionDetails);
    }

    async #initiateConnection() {
        const { hostname, port, password } = this.#connectionDetails;

        this.#obsClient = new ObsClient();

        this.#obsClient.addEventListener(ObsClientEvent.connectionStateChanged, this.onConnectionStateChanged);
        this.#obsClient.addEventListener(ObsClientEvent.currentProgramSceneChanged, this.onCurrentProgramSceneChanged);

        this.#connecting = true;
        m.redraw();
        
        await this.#obsClient.connect({ hostname, port, password });

        this.#connecting = false;
        m.redraw();
    }

    /**
     * @param {CustomEvent<{ connectionState: (typeof ConnectionState)[keyof typeof ConnectionState] }>} event - connectionStateChanged event
     */
    #onConnectionStateChanged(event) {
        const { connectionState } = event.detail;

        switch (connectionState) {
            case ConnectionState.Connected:
                this.#connecting = false;
                this.#connected = true;
                void this.#onConnected();
                break;
            case ConnectionState.Connecting:
                this.#connecting = true;
                this.#connected = false;
                break;
            case ConnectionState.ConnectionFailed:
                this.#connecting = false;
                this.#connected = false;
                void this.#onConnectionFailed();
                break;
            default:
        }

        m.redraw();
    }

    async #onConnected() {
        const { scenes, currentProgramSceneName } = await this.#obsClient.getScenesInfo();

        this.#scenes = scenes;
        this.#currentProgramSceneName = currentProgramSceneName;

        m.redraw();
    }

    async #onConnectionFailed() {
        this.#obsClient.removeEventListener(ObsClientEvent.connectionStateChanged, this.onConnectionStateChanged);
        this.#obsClient.removeEventListener(ObsClientEvent.currentProgramSceneChanged, this.onCurrentProgramSceneChanged);
        this.#obsClient.destroy();

        this.#obsClient = null; // Release object reference
    }

    /**
     * @param {CustomEvent<{ sceneName: string }>} event - connectionStateChanged event
     */
    #onCurrentProgramSceneChanged(event) {
        const { sceneName } = event.detail;

        if (sceneName == null) {
            return;
        }

        this.#currentProgramSceneName = sceneName;

        m.redraw();
    }

    #createSceneList() {
        const buttons = this.#scenes.map((scene) => {
            return m('button', {
                key: scene.sceneName,
                className: scene.sceneName === this.#currentProgramSceneName ? 'active-scene' : '',
                onclick: () => {
                    this.#obsClient.setCurrentProgramScene(scene.sceneName);
                }
            }, scene.sceneName)
        });

        return buttons;
    }

    #changeConnectionDetails(connectionDetails) {
        for (const [key, value] of Object.entries(connectionDetails)) {
            if (!(key in this.#connectionDetails)) {
                console.error(`Not a valid key: ${key}. Skipped setting value`);
                continue;
            }

            this.#connectionDetails[key] = value;
        }

        this.#persistConnectionDetails();
    }

    #resetConnectionDetails() {
        this.#changeConnectionDetails({
            hostname: window.location.hostname,
            port: DEFAULT_OBS_PORT,
        })
    }

    #getConnectionDetailsForm() {
        const { hostname, port, password } = this.#connectionDetails;

        return m('.connection-credentials', [
            m('label', { key: 'host' }, [
                'host',
                m('input', {
                    placeholder: window.location.hostname,
                    value: hostname ?? '',
                    onchange: (event) => {
                        const hostname = event.target.value || window.location.hostname;

                        this.#changeConnectionDetails({ hostname });
                    }
                })
            ]),
            m('label', { key: 'port' }, [
                'port',
                m('input', {
                    type: 'number',
                    size: 5,
                    min: 0,
                    max: 65535,
                    placeholder: DEFAULT_OBS_PORT,
                    value: port,
                    onchange: (event) => {
                        const port = event.target.value != null ? parseInt(event.target.value, 10) : 4455;

                        this.#changeConnectionDetails({ port });
                    }
                })
            ]),
            m('label', { key: 'password' }, [
                'password',
                m('input', {
                    type: 'password',
                    value: password ?? '',
                    onchange: (event) => {
                        const password = event.target.value || null;

                        this.#changeConnectionDetails({ password });
                    }
                })
            ]),
            m('button', {
                key: 'connect-button',
                type: 'submit',
                onclick: (event) => {
                    event.preventDefault();
                    this.#initiateConnection();
                }
            }, 'CONNECT'),
            m('button', {
                key: 'reset-button',
                type: 'reset',
                onclick: (event) => {
                    event.preventDefault();
                    this.#resetConnectionDetails();
                }
            }, 'RESET')
        ]);
    }

    view() {
        if (!this.#connected) {
            return m(
                '#container.not-connected',
                this.#connecting ? [
                    m(
                        'h2',
                        { key: 'connection-info' },
                        'Conectando a OBS...'
                    )
                ] : this.#getConnectionDetailsForm()
            );
        }

        return m('#container.connected', [
            m('#scenes', { key: 'scenes' }, [
                m('h5', 'ESCENAS'),
                m('.scenes-list', this.#createSceneList()),
            ]),
            m('#actions', { key: 'actions' })
        ]);
    }
}
