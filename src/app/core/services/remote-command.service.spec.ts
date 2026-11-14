import {NgZone} from '@angular/core';
import {emit, listen} from '@tauri-apps/api/event';
import {CommandSubject} from './remote-command.service';
import {mockBackend, resetBackend} from '../../../testing/tauri-mock';

describe('CommandSubject text output', () => {
    afterEach(() => resetBackend());

    it('preserves split UTF-8 characters and flushes the final unterminated line', async () => {
        mockBackend({});
        const token = 'split-output';
        let started!: () => void;
        const ready = new Promise<void>(resolve => started = resolve);
        const unlisten = await listen(`${token}:tx`, () => started());
        const proc = new CommandSubject<string>({run: (fn: () => void) => fn()} as NgZone,
            token, 'test', 'utf-8');
        const lines: string[] = [];
        proc.subscribe(value => lines.push(value.data));
        await ready;
        const bytes = new TextEncoder().encode('Привет\nконец');
        await emit(`${token}:rx`, {fd: 0, data: [...bytes.slice(0, 1)]});
        await emit(`${token}:rx`, {fd: 0, data: [...bytes.slice(1)]});
        await emit(`${token}:closed`, {type: 'Exit', status: 0});
        expect(lines).toEqual(['Привет', 'конец']);
        unlisten();
    });

    it('preserves the process error instead of emitting an incomplete line on failure', async () => {
        mockBackend({});
        const token = 'failed-output';
        let started!: () => void;
        const ready = new Promise<void>(resolve => started = resolve);
        const unlisten = await listen(`${token}:tx`, () => started());
        const proc = new CommandSubject<string>({run: (fn: () => void) => fn()} as NgZone,
            token, 'test', 'utf-8');
        const lines: string[] = [];
        let failure: any;
        proc.subscribe({next: value => lines.push(value.data), error: error => failure = error});
        await ready;
        await emit(`${token}:rx`, {fd: 0, data: [...new TextEncoder().encode('{partial')]});
        await emit(`${token}:closed`, {type: 'Exit', status: 1});
        expect(lines).toEqual([]);
        expect(failure.status).toBe(1);
        unlisten();
    });
});
