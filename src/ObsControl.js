import m from 'mithril';
import { ObsClient, ObsClientEvent, ConnectionState } from './lib/ObsClient';

export class ObsControl {
    /**
     * @type {ObsClient}
     */
    #obsClient;

    #connecting = false;
    #connected = false;

    #scenes = [];
    #currentProgramSceneName = null;

    async oninit() {
        this.onConnectionStateChanged = this.#onConnectionStateChanged.bind(this);
        this.onCurrentProgramSceneChanged = this.#onCurrentProgramSceneChanged.bind(this);

        void this.#initiateConnection();
    }

    async #initiateConnection() {
        const ip = import.meta.env.VITE_OBS_IP;
        const port = import.meta.env.VITE_OBS_PORT;
        const password = import.meta.env.VITE_OBS_PASSWORD;

        this.#obsClient = new ObsClient();

        this.#obsClient.addEventListener(ObsClientEvent.connectionStateChanged, this.onConnectionStateChanged);
        this.#obsClient.addEventListener(ObsClientEvent.currentProgramSceneChanged, this.onCurrentProgramSceneChanged);

        this.#connecting = true;
        m.redraw();
        
        await this.#obsClient.connect({ ip, port, password });

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

        setTimeout(() => {
            if (this.#connected || this.#connecting) {
                return;
            }

            this.initiateConnection();
        }, 1000);
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

    view() {
        if (!this.#connected) {
            return m('#container.not-connected', [
                    m(
                        'h2',
                        { key: 'connection-info' },
                        this.#connecting ? 'Conectando a OBS...' : 'Falló la conexión. Has abierto OBS?'
                    )
                ]
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
