import {Pipe, PipeTransform} from "@angular/core";
import {DomSanitizer} from '@angular/platform-browser';

@Pipe({
    name: 'trustUri',
    standalone: false
})
export class TrustUriPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {
  }

  // Our own scheme (icons served from the TV) plus ordinary HTTPS image sources.
  // Relative paths go through Angular's default binding with no bypass.
  // Anything else is dropped.
  transform(uri?: string) {
    if (!uri) {
      return undefined;
    }
    if (uri.startsWith('https://') || uri.startsWith('http://') ||
        uri.startsWith('data:image/') || uri.startsWith('remote-file:')) {
      return this.sanitizer.bypassSecurityTrustUrl(uri);
    }
    if (uri.startsWith('/')) {
      return uri;
    }
    return undefined;
  }

}
