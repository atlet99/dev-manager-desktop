import {DeviceInfo} from "./device-manager.service";
import {PackageRequirements} from "./apps-repo.service";

const info = (over: Partial<DeviceInfo> = {}): Partial<DeviceInfo> => ({osVersion: '4.0.5', socName: 'lucid', ...over});

describe('PackageRequirements.checkIncompatibility', () => {
    it('accepts releases that satisfy the range', () => {
        expect(new PackageRequirements({webosRelease: '>=4.0'}).checkIncompatibility(info())).toBeNull();
    });

    it('rejects releases outside the range', () => {
        expect(new PackageRequirements({webosRelease: '>=5.0'}).checkIncompatibility(info())).toEqual(['release']);
    });

    it('accepts SoCs in the allowlist and rejects the rest', () => {
        expect(new PackageRequirements({deviceSoC: ['lucid', 'anvil']}).checkIncompatibility(info())).toBeNull();
        expect(new PackageRequirements({deviceSoC: ['anvil']}).checkIncompatibility(info())).toEqual(['soc']);
    });

    it('honours the exclusion prefix', () => {
        expect(new PackageRequirements({deviceSoC: ['!lucid']}).checkIncompatibility(info())).toEqual(['soc']);
        expect(new PackageRequirements({deviceSoC: ['!anvil']}).checkIncompatibility(info())).toBeNull();
    });

    it('skips checks when the manifest entry has a missing or malformed shape', () => {
        expect(new PackageRequirements({}).checkIncompatibility(info())).toBeNull();
        expect(new PackageRequirements({deviceSoC: null as any}).checkIncompatibility(info())).toBeNull();
        expect(new PackageRequirements({deviceSoC: 'lucid' as any}).checkIncompatibility(info())).toBeNull();
        expect(new PackageRequirements({deviceSoC: [null, 123, 'lucid'] as any}).checkIncompatibility(info())).toBeNull();
        expect(new PackageRequirements({webosRelease: 5 as any}).checkIncompatibility(info())).toBeNull();
    });

    it('skips checks when the device info is partial', () => {
        expect(new PackageRequirements({webosRelease: '>=4.0', deviceSoC: ['lucid']}).checkIncompatibility({})).toBeNull();
    });
});
