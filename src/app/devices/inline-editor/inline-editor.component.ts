import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {AppPrivKeyName, Device, NewDevice, NewDeviceAuthentication} from "../../types";
import {
    DeviceEditorComponent,
    OpenSshLocalKeyValue,
    SetupAuthInfoUnion
} from "../../add-device/device-editor/device-editor.component";

@Component({
    selector: 'app-device-inline-editor',
    templateUrl: './inline-editor.component.html',
    imports: [
        DeviceEditorComponent
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './inline-editor.component.scss'
})
export class InlineEditorComponent {
    @Input()
    device!: Device;

    @Output()
    save: EventEmitter<NewDevice> = new EventEmitter();

    @Output()
    remove: EventEmitter<Device> = new EventEmitter();

    @Output()
    closed: EventEmitter<void> = new EventEmitter();

    constructor(private modals: NgbModal) {
    }

    get deviceAuth(): SetupAuthInfoUnion {
        if (this.device.password) {
            return {type: NewDeviceAuthentication.Password, value: this.device.password};
        } else if (this.device.username === 'prisoner' && this.device.privateKey) {
            return {
                type: NewDeviceAuthentication.DevKey,
                value: this.device.passphrase!
            };
        } else if (this.device.privateKey?.openSsh === AppPrivKeyName) {
            return {
                type: NewDeviceAuthentication.AppKey,
                value: null,
            };
        } else if (this.device.privateKey) {
            return {
                type: NewDeviceAuthentication.LocalKey,
                value: new OpenSshLocalKeyValue(this.device.privateKey.openSsh, this.device.passphrase),
            }
        } else {
            return {type: NewDeviceAuthentication.None, value: null};
        }
    }

    async doSave(editor: DeviceEditorComponent) {
        try {
            const dev = await editor.submit();
            this.save.emit(dev);
        } catch (e) {
            MessageDialogComponent.open(this.modals, {
                title: 'Unable to save device',
                message: String(e),
                positive: 'Dismiss',
            });
        }
    }
}
