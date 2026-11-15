vi.mock('@tauri-apps/plugin-shell', () => ({
    open: vi.fn(),
}));

import {open} from '@tauri-apps/plugin-shell';
import {openWebLink} from './web-links';

const mockedOpen = vi.mocked(open);

describe('openWebLink', () => {
    beforeEach(() => mockedOpen.mockReset());

    it('opens http, https and mailto links', async () => {
        mockedOpen.mockResolvedValue(undefined);
        await openWebLink('https://example.com/path');
        await openWebLink('http://example.com/');
        await openWebLink('mailto:dev@example.com');
        expect(mockedOpen).toHaveBeenCalledTimes(3);
    });

    it('normalizes the scheme before checking', async () => {
        mockedOpen.mockResolvedValue(undefined);
        await openWebLink('HTTPS://EXAMPLE.COM/');
        expect(mockedOpen).toHaveBeenCalledWith('HTTPS://EXAMPLE.COM/');
    });

    it('refuses everything else', async () => {
        await openWebLink('file:///etc/passwd');
        await openWebLink('javascript:alert(1)');
        await openWebLink('not a url');
        await openWebLink('remote-file://localhost/icon.png');
        expect(mockedOpen).not.toHaveBeenCalled();
    });
});
