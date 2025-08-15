import { EventSubscription, OBSWebSocket } from 'obs-websocket-js';

export const DEFAULT_OBS_PORT = 4455;

export const ObsClientEvent = Object.freeze({
    connectionStateChanged: 'connectionStateChanged',
    currentProgramSceneChanged: 'currentProgramSceneChanged'
});

export const ConnectionState = Object.freeze({
    Connecting: 'connecting',
    Connected: 'connected',
    ConnectionFailed: 'connectionFailed'
});

export class ObsClient extends EventTarget {
    /**
     * @type {OBSWebSocket}
     */
    #obs;

    constructor() {
        super();

        this.onCurrentProgramSceneChanged = this.#onCurrentProgramSceneChanged.bind(this);
    }

    async connect({ hostname, port, password } = { port: DEFAULT_OBS_PORT }) {
        this.dispatchEvent(new CustomEvent(ObsClientEvent.connectionStateChanged, {
            detail: {
                connectionState: ConnectionState.Connecting
            }
        }));

        this.#obs = new OBSWebSocket();

        this.#obs.on('CurrentProgramSceneChanged', this.onCurrentProgramSceneChanged);

        try {
            // 1) Connect (use your OBS IP/port; password if enabled)
            const {
                obsWebSocketVersion,
                negotiatedRpcVersion
            } = await this.#obs.connect(`ws://${hostname}:${port}`, password, {
                eventSubscriptions: EventSubscription.Scenes
            });

            this.dispatchEvent(new CustomEvent(ObsClientEvent.connectionStateChanged, {
                detail: {
                    connectionState: ConnectionState.Connected,
                    obsWebSocketVersion,
                    negotiatedRpcVersion
                }
            }));
        } catch (error) {
            this.dispatchEvent(new CustomEvent(ObsClientEvent.connectionStateChanged, {
                detail: {
                    connectionState: ConnectionState.ConnectionFailed,
                    message: error.message,
                    code: error.code
                }
            }));
        }
    }

    #onCurrentProgramSceneChanged(event) {
        const { sceneName } = event;

        this.dispatchEvent(new CustomEvent(ObsClientEvent.currentProgramSceneChanged, { detail: { sceneName }}));
    }

    async getScenesInfo() {
        if (this.#obs == null) {
            throw new Error('Not tried to connect?');
            return;
        }

        const { scenes, currentProgramSceneName } = await this.#obs.call('GetSceneList');

        scenes.reverse();

        return {
            scenes,
            currentProgramSceneName
        }
    }

    async setCurrentProgramScene(sceneName) {
        if (this.#obs == null) {
            throw new Error('Not tried to connect?');
            return;
        }

        await this.#obs.call('SetCurrentProgramScene', { sceneName });
    }
    
    destroy() {
        this.#obs.off('CurrentProgramSceneChanged', this.onCurrentProgramSceneChanged);
    }
}