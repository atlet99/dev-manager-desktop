import {TrustUriPipe} from './trust-uri.pipe';

function fakeSanitizer(): any {
    return {bypassSecurityTrustUrl: (value: string) => value};
}

describe('TrustUriPipe', () => {
    const pipe = new TrustUriPipe(fakeSanitizer() as any);

    it('passes through trusted image schemes', () => {
        expect(pipe.transform('https://example.com/icon.png')).toBe('https://example.com/icon.png');
        expect(pipe.transform('http://example.com/icon.png')).toBe('http://example.com/icon.png');
        expect(pipe.transform('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
        expect(pipe.transform('remote-file://localhost/icon.png')).toBe('remote-file://localhost/icon.png');
    });

    it('passes relative paths without a bypass', () => {
        expect(pipe.transform('/assets/icon.png')).toBe('/assets/icon.png');
    });

    it('drops anything else', () => {
        expect(pipe.transform('javascript:alert(1)')).toBeUndefined();
        expect(pipe.transform('data:text/html,<script>alert(1)</script>')).toBeUndefined();
        expect(pipe.transform('file:///etc/passwd')).toBeUndefined();
        expect(pipe.transform('')).toBeUndefined();
        expect(pipe.transform(undefined)).toBeUndefined();
    });
});
