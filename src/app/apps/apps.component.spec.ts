import {BehaviorSubject, Subject} from 'rxjs';
import {vi} from 'vitest';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {AppsComponent} from './apps.component';
import {AppManagerService, DeviceManagerService} from '../core/services';
import {Device, PackageInfo} from '../types';

describe('AppsComponent device selection', () => {
    it('clears installed apps when switching devices or receiving an empty list', () => {
        const first = {name: 'first'} as Device;
        const second = {name: 'second'} as Device;
        const selected$ = new BehaviorSubject<Device | null>(first);
        const firstPackages = new Subject<PackageInfo[] | null>();
        const secondPackages = new Subject<PackageInfo[] | null>();
        const appManager = {
            packages$: vi.fn((device: Device) => device.name === first.name ? firstPackages : secondPackages),
            load: vi.fn().mockResolvedValue([]),
        };
        const component = new AppsComponent(
            {selected$, devices$: new BehaviorSubject([first, second])} as unknown as DeviceManagerService,
            {} as NgbModal,
            appManager as unknown as AppManagerService,
        );
        component.ngOnInit();
        firstPackages.next([{id: 'installed-on-first'} as PackageInfo]);
        expect(component.instPackages?.['installed-on-first']).toBeDefined();

        selected$.next(second);
        expect(component.instPackages).toBeUndefined();
        secondPackages.next([{id: 'installed-on-second'} as PackageInfo]);
        secondPackages.next([]);
        expect(component.instPackages).toEqual({});
        selected$.next(null);
        expect(component.instPackages).toBeUndefined();
        component.ngOnDestroy();
    });
});
