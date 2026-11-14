import {TestBed} from '@angular/core/testing';
import {emit} from '@tauri-apps/api/event';
import {firstValueFrom} from 'rxjs';
import {filter} from 'rxjs/operators';

import {DeviceManagerService} from './device-manager.service';
import {BackendError} from './backend-client';
import {Device} from '../../types';
import {backendError, mockBackend, resetBackend} from '../../../testing/tauri-mock';
import {vi} from 'vitest';

describe('DeviceManagerService', () => {
    const device = <Device>{
        name: 'test',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        profile: 'ose',
        privateKey: {openSsh: 'id_rsa'},
    };

    afterEach(() => resetBackend());

    it('resolves list() from the backend', async () => {
        mockBackend({'device-manager/list': () => [device]});
        const service = TestBed.inject(DeviceManagerService);
        await expect(service.list()).resolves.toEqual([device]);
    });

    it('does not log key material or passphrases during key retrieval', async () => {
        const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
        mockBackend({'device-manager/novacom_getkey': () => 'private-key-for-test'});
        const service = TestBed.inject(DeviceManagerService);
        try {
            await service.novacomGetKey('tv.local', 'passphrase-for-test');
            expect(JSON.stringify(debug.mock.calls)).not.toContain('passphrase-for-test');
            expect(JSON.stringify(debug.mock.calls)).not.toContain('private-key-for-test');
        } finally {
            debug.mockRestore();
        }
    });

    it('refreshes the selected device after saving changed connection settings', async () => {
        const updated = {...device, host: '192.168.1.2'};
        mockBackend({
            'device-manager/add': () => updated,
            'device-manager/list': () => [updated],
        });
        const service = TestBed.inject(DeviceManagerService);
        const selected = firstValueFrom(service.selected$.pipe(filter(Boolean)));

        await service.addDevice(updated as any);

        await expect(selected).resolves.toEqual(updated);
    });

    it('does not let an older device list replace a newer selection', async () => {
        mockBackend({});
        const service = TestBed.inject(DeviceManagerService);
        let resolveOld!: (devices: Device[]) => void;
        let resolveNew!: (devices: Device[]) => void;
        vi.spyOn(service, 'list')
            .mockReturnValueOnce(new Promise(resolve => resolveOld = resolve))
            .mockReturnValueOnce(new Promise(resolve => resolveNew = resolve));
        let selected: Device | null = null;
        const subscription = service.selected$.subscribe(value => selected = value);
        service.load();
        service.load();
        const updated = {...device, host: '192.168.1.2'};
        resolveNew([updated]);
        await Promise.resolve();
        resolveOld([device]);
        await Promise.resolve();
        expect(selected).toEqual(updated);
        subscription.unsubscribe();
    });

    it('pushes devicesUpdated events into devices$', async () => {
        // Mock first: the constructor subscribes via listen(), so a service built
        // before mockBackend() would attach its handler to the real IPC bridge.
        mockBackend({});
        const service = TestBed.inject(DeviceManagerService);
        const updated = firstValueFrom(service.devices$.pipe(filter(Boolean)));

        await emit('device-manager/devicesUpdated', [device]);

        expect(await updated).toEqual([device]);
    });

    it('maps a backend rejection to BackendError', async () => {
        mockBackend({
            'device-manager/list': () => {
                throw backendError('Timeout');
            },
        });
        const service = TestBed.inject(DeviceManagerService);

        await expect(service.list()).rejects.toBeDefined();
        const error = await service.list().catch(e => e);
        expect(BackendError.isCompatible(error)).toBe(true);
        expect(error.reason).toBe('Timeout');
        expect(error.call).toBe('device-manager/list');
    });

    it('fails loudly when a command has no mock', async () => {
        mockBackend({});
        const service = TestBed.inject(DeviceManagerService);
        await expect(service.list()).rejects.toThrow(/No mock for backend call/);
    });
});
