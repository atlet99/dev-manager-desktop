import {Component, Inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../../types';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {DeviceManagerService, DevModeStatus} from '../../core/services';
import {save as showSaveDialog} from '@tauri-apps/plugin-dialog'
import {writeTextFile} from '@tauri-apps/plugin-fs';
import renewScriptTemplate, {escapeShellValue, renewCacheName} from './renew-script.sh';
import Mustache from 'mustache';

@Component({
    selector: 'app-renew-script',
    templateUrl: './renew-script.component.html',
    styleUrls: ['./renew-script.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class RenewScriptComponent implements OnInit {

    public renewScriptContent?: string;

    constructor(
        public modal: NgbActiveModal,
        private deviceManager: DeviceManagerService,
        private modals: NgbModal,
        @Inject('device') public device: Device,
        @Inject('devMode') public devMode: DevModeStatus,
    ) {
    }

    ngOnInit(): void {
        this.deviceManager.readPrivKey(this.device).then(key => {
            this.renewScriptContent = Mustache.render(renewScriptTemplate, {
                device: this.device,
                cache: renewCacheName(this.device.name),
                keyContent: key.trim(),
            }, undefined, {
                escape: escapeShellValue,
            });
        }).catch(e => {
            console.error('Failed to read the app private key', e);
            MessageDialogComponent.open(this.modals, {
                title: 'Failed to prepare the renewal script',
                message: String(e),
                positive: 'Dismiss',
            });
        });
    }

    async copyScript(content: string): Promise<void> {
        await navigator.clipboard.writeText(content);
    }

    saveScript(content: string): void {
        showSaveDialog({
            defaultPath: `renew-devmode-${this.device.name}.sh`
        }).then(value => {
            if (!value) {
                return;
            }
            return writeTextFile(value, content);
        }).catch(e => {
            console.error('Failed to save the renewal script', e);
            MessageDialogComponent.open(this.modals, {
                title: 'Failed to save the script',
                message: String(e),
                positive: 'Dismiss',
            });
        });
    }
}
