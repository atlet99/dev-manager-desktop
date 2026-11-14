import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {InstalledComponent} from './installed.component';
import {AppsComponent} from '../apps.component';
import {AppsRepoService, RepositoryItem} from '../../core/services';
import {PackageInfo} from '../../types';

describe('InstalledComponent repository lookups', () => {
    it('ignores results from the previously selected device', async () => {
        let resolveFirst!: (value: Record<string, RepositoryItem>) => void;
        let resolveSecond!: (value: Record<string, RepositoryItem>) => void;
        const showApps = vi.fn()
            .mockReturnValueOnce(new Promise(resolve => resolveFirst = resolve))
            .mockReturnValueOnce(new Promise(resolve => resolveSecond = resolve));
        const component = new InstalledComponent({} as AppsComponent, {showApps} as unknown as AppsRepoService);
        const first = new Subject<PackageInfo[] | null>();
        const second = new Subject<PackageInfo[] | null>();
        component.installed$ = first;
        first.next([{id: 'first'} as PackageInfo]);
        component.installed$ = second;
        second.next([{id: 'second'} as PackageInfo]);
        const latest = {second: {} as RepositoryItem};
        resolveSecond(latest);
        await Promise.resolve();
        resolveFirst({first: {} as RepositoryItem});
        await Promise.resolve();
        expect(component.repoPackages).toEqual(latest);
        component.ngOnDestroy();
    });
});
