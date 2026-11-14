import {vi} from 'vitest';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {InfoComponent} from './info.component';
import {AppManagerService, AppsRepoService, DeviceManagerService, DevModeService, DevModeStatus} from '../core/services';
import {RemoteFileService} from '../core/services/remote-file.service';
import {Device} from '../types';
import {BehaviorSubject} from 'rxjs';

describe('InfoComponent device changes', () => {
    it('keeps Homebrew data for the currently selected device', async () => {
        let resolveFirst!: (value: any) => void;
        let resolveSecond!: (value: any) => void;
        const info = vi.fn()
            .mockReturnValueOnce(new Promise(resolve => resolveFirst = resolve))
            .mockReturnValueOnce(new Promise(resolve => resolveSecond = resolve));
        const config = vi.fn((device: Device) => Promise.resolve({root: device.name === 'second'}));
        const manifest = {manifest: {hasUpdate: (version: string) => version === 'old'}};
        const component = new InfoComponent({} as NgbModal,
            {getHbChannelConfig: config} as unknown as DeviceManagerService,
            {} as RemoteFileService, {info} as unknown as AppManagerService,
            {showApp: vi.fn().mockResolvedValue(manifest)} as unknown as AppsRepoService, {} as DevModeService);
        const first = {name: 'first'} as Device;
        const second = {name: 'second'} as Device;
        component.device = first;
        const old = (component as any).loadHomebrewInfo(first);
        component.device = second;
        const current = (component as any).loadHomebrewInfo(second);
        resolveSecond({version: 'new'});
        await current;
        resolveFirst({version: 'old'});
        await old;
        expect(component.homebrewAppInfo?.version).toBe('new');
        expect(component.homebrewAppConfig).toEqual({root: true});
        expect(component.homebrewRepoHasUpdate).toBe(false);
    });

    it('ignores an in-flight info response when the device is deselected', async () => {
        let resolveInfo!: (info: any) => void;
        const selected$ = new BehaviorSubject<Device | null>({name: 'first'} as Device);
        const deviceManager = {selected$, getDeviceInfo: vi.fn(() => new Promise(resolve => resolveInfo = resolve))};
        const component = new InfoComponent({} as NgbModal, deviceManager as unknown as DeviceManagerService,
            {} as RemoteFileService, {} as AppManagerService, {} as AppsRepoService, {} as DevModeService);
        component.ngOnInit();
        selected$.next(null);
        resolveInfo({modelName: 'old'});
        await Promise.resolve();
        expect(component.deviceInfo).toBeNull();
        component.ngOnDestroy();
    });

    it('does not show a previous device’s Developer Mode status', async () => {
        let resolveFirst!: (status: DevModeStatus) => void;
        let resolveSecond!: (status: DevModeStatus) => void;
        const status = vi.fn()
            .mockReturnValueOnce(new Promise(resolve => resolveFirst = resolve))
            .mockReturnValueOnce(new Promise(resolve => resolveSecond = resolve));
        const component = new InfoComponent({} as NgbModal, {} as DeviceManagerService,
            {} as RemoteFileService, {} as AppManagerService, {} as AppsRepoService,
            {status} as unknown as DevModeService);
        const first = {name: 'first', username: 'prisoner'} as Device;
        const second = {name: 'second', username: 'prisoner'} as Device;
        component.device = first;
        const old = (component as any).loadDevModeInfo(first);
        component.device = second;
        const current = (component as any).loadDevModeInfo(second);
        resolveSecond({remaining: 'new'});
        await current;
        resolveFirst({remaining: 'old'});
        await old;
        expect(component.devModeInfo).toEqual({remaining: 'new'});
    });
});
