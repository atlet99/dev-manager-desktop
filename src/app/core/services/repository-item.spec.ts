import {RepositoryItem, RepositoryPage} from './apps-repo.service';

const url = 'https://repo.webosbrew.org/api/apps.json';

describe('RepositoryItem', () => {
    it('keeps an absolute description URL', () => {
        expect(new RepositoryItem({
            id: 'org.webosbrew.example',
            fullDescriptionUrl: 'https://example.com/readme',
        }, url).fullDescriptionUrl).toBe('https://example.com/readme');
    });

    it('resolves a relative description URL against the page URL', () => {
        expect(new RepositoryItem({
            id: 'org.webosbrew.example',
            fullDescriptionUrl: '/readme.html',
        }, url).fullDescriptionUrl).toBe('https://repo.webosbrew.org/readme.html');
    });

    it('drops a malformed description URL instead of throwing', () => {
        expect(new RepositoryItem({
            id: 'org.webosbrew.example',
            fullDescriptionUrl: 'https://example.com:99999/',
        }, url).fullDescriptionUrl).toBeUndefined();
    });
});

describe('RepositoryPage', () => {
    const paging = {page: 1, count: 2, maxPage: 1, itemsTotal: 2};

    it('keeps the healthy packages and ignores the malformed URL', () => {
        const page = new RepositoryPage({
            paging,
            packages: [
                {id: 'org.webosbrew.good', title: 'Good'},
                {id: 'org.webosbrew.bad', title: 'Bad', fullDescriptionUrl: 'https://example.com:99999/'},
            ],
        } as any, url);
        expect(page.packages.map(pkg => pkg.id)).toEqual(['org.webosbrew.good', 'org.webosbrew.bad']);
        expect(page.packages[1].fullDescriptionUrl).toBeUndefined();
    });
});
