import {Buffer} from 'buffer';
import {convertOutput, ExecutionError} from './execution-error';
import type {BackendErrorBody} from './backend-client';

describe('convertOutput', () => {
    it('decodes UTF-8 bytes', () => {
        expect(convertOutput([...new TextEncoder().encode('Привет')], 'utf-8')).toBe('Привет');
    });

    it('returns raw bytes as a Buffer by default', () => {
        const result = convertOutput([65, 66], 'buffer');
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString('utf-8')).toBe('AB');
    });
});

describe('ExecutionError.fromBackendError', () => {
    const body: BackendErrorBody = {
        reason: 'ExitStatus',
        command: 'luna-send-pub -n 1 luna://x {}',
        exit_code: 1,
        stderr: [104, 105],
        unhandled: false,
    };

    it('wraps the body into a readable error', () => {
        const error = ExecutionError.fromBackendError(body);
        expect(error).toBeInstanceOf(ExecutionError);
        expect(error.status).toBe(1);
        expect(error.details).toBe('hi');
        expect(error.command).toBe(body['command']);
        expect(error.message).toContain('1');
    });

    it('tolerates a missing stderr payload', () => {
        const error = ExecutionError.fromBackendError({reason: 'ExitStatus', command: 'cmd', exit_code: 2});
        expect(error.details).toBe('');
        expect(error.status).toBe(2);
    });
});
