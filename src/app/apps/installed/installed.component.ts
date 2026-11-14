import {Component, Host, Input, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable, Subscription} from "rxjs";
import {AppsRepoService, RepositoryItem} from "../../core/services";

@Component({
    selector: 'app-installed',
    templateUrl: './installed.component.html',
    styleUrls: ['./installed.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InstalledComponent implements OnDestroy {

    @Input()
    device: Device | null = null;

    installedError?: Error;

    repoPackages?: Record<string, RepositoryItem>;

    private subscription?: Subscription;
    private installedField?: Observable<PackageInfo[] | null>;
    private lookupGeneration = 0;

    constructor(@Host() public parent: AppsComponent, private appsRepo: AppsRepoService) {
    }

    @Input()
    set installed$(value: Observable<PackageInfo[] | null> | undefined) {
        this.lookupGeneration++;
        this.repoPackages = undefined;
        this.installedError = undefined;
        this.subscription?.unsubscribe();
        this.subscription = value?.subscribe({
            next: (pkgs) => {
                this.installedError = undefined;

                const strings: string[] = pkgs?.map((pkg) => pkg.id) ?? [];
                const generation = ++this.lookupGeneration;
                this.appsRepo.showApps(...strings).then(apps => {
                    if (generation === this.lookupGeneration) this.repoPackages = apps;
                });
            },
            error: (error) => {
                this.lookupGeneration++;
                this.repoPackages = undefined;
                console.log('installed apps', error);
                return this.installedError = error;
            }
        });
        this.installedField = value;
    }

    get installed$(): Observable<PackageInfo[] | null> | undefined {
        return this.installedField;
    }

    ngOnDestroy(): void {
        this.lookupGeneration++;
        this.subscription?.unsubscribe();
    }

    loadPackages(): void {
        this.installedError = undefined;
        this.parent.loadPackages();
    }
}
