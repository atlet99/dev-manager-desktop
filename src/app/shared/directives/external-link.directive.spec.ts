vi.mock('@tauri-apps/plugin-shell', () => ({
    open: vi.fn(),
}));

import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {open} from '@tauri-apps/plugin-shell';

import {ExternalLinkDirective} from './external-link.directive';

const mockedOpen = vi.mocked(open);

@Component({
    selector: 'app-test-external-link-host',
    imports: [ExternalLinkDirective],
    template: `<a href="https://webostv.developer.lge.com/develop/getting-started/developer-mode-app"
                  appExternalLink>link</a>`,
})
class HostComponent {
}

describe('ExternalLinkDirective', () => {
    beforeEach(() => mockedOpen.mockReset());

    afterEach(() => vi.restoreAllMocks());

    it('opens the link without window.open when the shell opener succeeds', async () => {
        mockedOpen.mockResolvedValue(undefined);
        const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
        link.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockedOpen).toHaveBeenCalledWith('https://webostv.developer.lge.com/develop/getting-started/developer-mode-app');
        expect(windowOpen).not.toHaveBeenCalled();
    });
});
