import {parseMonitorMessage} from './ls-monitor.component';

describe('parseMonitorMessage', () => {
    it('parses a valid ls-monitor line', () => {
        const line = JSON.stringify({
            senderUniqueName: 'a', destinationUniqueName: 'b', type: 'call',
            token: 1, transport: 'TX', sender: 'com.webos.app.sender', destination: 'com.webos.service',
            methodCategory: 'luna:/', method: 'doThing',
        });
        expect(parseMonitorMessage(line)).toMatchObject({method: 'doThing', transport: 'TX'});
    });

    it('returns undefined for malformed lines instead of throwing', () => {
        expect(parseMonitorMessage('not json {')).toBeUndefined();
        expect(parseMonitorMessage('')).toBeUndefined();
        expect(parseMonitorMessage('LS service ready')).toBeUndefined();
    });
});
