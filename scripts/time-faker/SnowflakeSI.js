"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnowflakeSiGenerator = exports.DEFAULT_CLOCK_BIT_WIDTH = exports.DEFAULT_MACHINE_ID_BIT_WIDTH = exports.MIN_EPOCH_40 = void 0;
/**
 *  Copyright 2025 Angus.Fenying <fenying@litert.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
const NodeTimers = require("node:timers/promises");
const eL = require("./Errors");
const Sf = require("./Snowflake");
const DEFAULT_BULK_OPTIONS = {
    'maxRetries': 3,
    'retryDelayMs': 1,
};
const MIN_BIT_WIDTH = 1;
const MIN_MACHINE_ID = 0;
const MAX_ID_BIT_LENGTH = 53;
/**
 * Minimal epoch when the click bit-width is 40: `2003-03-18T07:20:19.225Z`.
 */
exports.MIN_EPOCH_40 = 1047972019225;
/**
 * The default bit width of the machine ID is 5 bits, which means the range of the machine ID is [0, 31].
 *
 * > So the default capacity of snowflake-si ID is 2^7 = 128, per millisecond.
 */
exports.DEFAULT_MACHINE_ID_BIT_WIDTH = 5;
/**
 * The default bit width of the clock part is 41 bits.
 */
exports.DEFAULT_CLOCK_BIT_WIDTH = 40;
/**
 * The class for generating Snowflake (Safe-Integer) IDs.
 */
class SnowflakeSiGenerator {
    /**
     * The strategy for the time reversal event.
     */
    _onTimeReversedStrategy;
    _onTimeChangedCallback;
    _onTimeChangedStrategy;
    _onTimeChangedResetThreshold = 0;
    /**
     * The identifier of the machine that generates the UUID.
     *
     * For the SnowflakeSI ID of a specific resource, each generator must use a unique machine ID
     * so that the generated IDs will not conflict with each other.
     *
     * The range of the machine ID depends on the `machineIdBitWidth`:
     *
     * - If `machineIdBitWidth` is 1, the range is [0, 1].
     * - If `machineIdBitWidth` is 2, the range is [0, 3].
     * - ...
     * - If `machineIdBitWidth` is 7, the range is [0, 127].
     * - If `machineIdBitWidth` is 8, the range is [0, 255].
     */
    machineId;
    /**
     * The epoch of the generator.
     */
    epoch;
    /**
     * The bit width of the machine ID, must be an integer between 1 and 8.
     *
     * The sum of `machineIdBitWidth` and `sequenceBitWidth` must be 12.
     *
     * @default 5
     */
    machineIdBitWidth;
    /**
     * The bit width of the sequence number, must be an integer between 8 and 11.
     *
     * The sum of `machineIdBitWidth` and `sequenceBitWidth` must be 12.
     *
     * @default 7
     */
    sequenceBitWidth;
    /**
     * The bit width of the clock part.
     *
     * It must be an integer between 40 and 41.
     * When 40 is chosen, the epoch must not be earlier than `2003-03-18T07:20:19.225Z` to
     * keep the clock part within 40 bits (before `2038-01-19T03:14:07Z`).
     *
     * @default 40
     */
    clockBitWidth;
    _midPart;
    /**
     * The maximum sequence of the generator, per millisecond.
     */
    maximumSequence;
    _prevTime = 0;
    _seq = 0;
    _countPerMs = 0;
    _clockFactor;
    constructor(opts) {
        const clockWidth = opts.clockBitWidth ?? exports.DEFAULT_CLOCK_BIT_WIDTH;
        const LOW_BIT_WIDTH = MAX_ID_BIT_LENGTH - clockWidth;
        const midWidth = opts.machineIdBitWidth ?? exports.DEFAULT_MACHINE_ID_BIT_WIDTH;
        const seqWidth = opts.sequenceBitWidth ?? (LOW_BIT_WIDTH - midWidth);
        if (!Number.isInteger(clockWidth) ||
            clockWidth < 40 || clockWidth > 41 ||
            !Number.isInteger(midWidth) ||
            !Number.isInteger(seqWidth) ||
            midWidth < MIN_BIT_WIDTH ||
            seqWidth < MIN_BIT_WIDTH ||
            midWidth + seqWidth + clockWidth !== MAX_ID_BIT_LENGTH) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'invalid_bit_width',
                'machineIdBitWidth': midWidth,
                'clockBitWidth': clockWidth,
                'sequenceBitWidth': seqWidth,
            });
        }
        const MAX_MACHINE_ID = (1 << midWidth) - 1;
        if (!Number.isInteger(opts.machineId) ||
            opts.machineId < MIN_MACHINE_ID ||
            opts.machineId > MAX_MACHINE_ID) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'invalid_machine_id',
                'machineIdBitWidth': midWidth,
                'machineId': opts.machineId,
            });
        }
        if (clockWidth === 40 && opts.epoch < exports.MIN_EPOCH_40) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'epoch_too_early',
                'epoch': opts.epoch,
                'clockBitWidth': clockWidth,
                'minEpoch': exports.MIN_EPOCH_40,
            });
        }
        if (typeof opts.epoch !== 'number' || !Number.isSafeInteger(opts.epoch) || opts.epoch < 0) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'invalid_epoch',
                'epoch': opts.epoch,
            });
        }
        this.epoch = opts.epoch;
        this.machineId = opts.machineId;
        this.machineIdBitWidth = midWidth;
        this.sequenceBitWidth = seqWidth;
        this.clockBitWidth = clockWidth;
        this._clockFactor = 1 << LOW_BIT_WIDTH;
        this.maximumSequence = (1 << this.sequenceBitWidth) - 1;
        this._midPart = opts.machineId << this.sequenceBitWidth;
        this._onTimeReversedStrategy = opts.onTimeReversed ?? Sf.SNOWFLAKE_DEFAULT_TIME_REVERSAL_STRATEGY;
        switch (opts.onTimeChanged ?? Sf.SNOWFLAKE_DEFAULT_TIME_CHANGED_STRATEGY) {
            case Sf.ESnowflakeSequenceStrategy.RESET:
                const seqResetThreshold = opts.sequenceResetThreshold ?? 0;
                if (!Number.isInteger(seqResetThreshold) ||
                    seqResetThreshold < 0 ||
                    seqResetThreshold > this.maximumSequence) {
                    throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                        'reason': 'invalid_sequence_reset_threshold',
                        'sequenceResetThreshold': seqResetThreshold,
                    });
                }
                this._onTimeChangedStrategy = Sf.ESnowflakeSequenceStrategy.RESET;
                this._onTimeChangedResetThreshold = seqResetThreshold;
                break;
            case Sf.ESnowflakeSequenceStrategy.KEEP_CURRENT:
                this._onTimeChangedStrategy = Sf.ESnowflakeSequenceStrategy.KEEP_CURRENT;
                break;
            default:
                this._onTimeChangedStrategy = false;
                this._onTimeChangedCallback = opts.onTimeChanged;
                break;
        }
    }
    /**
     * Generate a bulk of Snowflake IDs.
     *
     * This method helps generate batch of Snowflake IDs, handling the time
     * reversed and sequence overflow scenarios automatically.
     *
     * @param qty The quantity of IDs to generate.
     * @param opts The options for bulk generation.
     *
     * @returns A promise that resolves to an array of Snowflake IDs.
     */
    async bulkGenerate(qty, opts = DEFAULT_BULK_OPTIONS) {
        opts.maxRetries ??= DEFAULT_BULK_OPTIONS.maxRetries;
        opts.retryDelayMs ??= DEFAULT_BULK_OPTIONS.retryDelayMs;
        const ret = new Array(qty);
        for (let i = 0, fails = 0; i < qty; i++) {
            try {
                ret[i] = this.generate();
                fails = 0;
            }
            catch (e) {
                if (fails++ === opts.maxRetries) {
                    throw e;
                }
                switch (true) {
                    case e instanceof eL.E_SEQUENCE_OVERFLOWED:
                    case e instanceof eL.E_TIME_REVERSED:
                        await NodeTimers.setTimeout(opts.retryDelayMs);
                        i--;
                        break;
                    default:
                        throw e;
                }
            }
        }
        return ret;
    }
    /**
     * Generate the next SnowflakeSI ID, based on the current time and the next sequence number.
     *
     * @returns A SnowflakeSI ID, which is a 53-bit integer (number type).
     *
     * @throws {E_TIME_REVERSED} If the current time is earlier than the previous time.
     * @throws {E_SEQUENCE_OVERFLOWED} If the sequence number exceeds the maximum value.
     * @throws {E_TIME_BEFORE_EPOCH} If the current time is earlier than the epoch.
     */
    generate() {
        const NOW = Date.now();
        if (this.epoch > NOW) {
            throw new eL.E_TIME_BEFORE_EPOCH({ epoch: this.epoch, time: NOW });
        }
        let timeOffset = NOW - this.epoch;
        if (this._prevTime > timeOffset) {
            switch (this._onTimeReversedStrategy) {
                case Sf.ESnowflakeTimeReversedStrategy.THROW_ERROR:
                    throw new eL.E_TIME_REVERSED({
                        previous: this._prevTime + this.epoch,
                        current: timeOffset + this.epoch
                    });
                case Sf.ESnowflakeTimeReversedStrategy.USE_REVERSED_TIME:
                    // do nothing, because `timeOffset` is the reversed time.
                    break;
                case Sf.ESnowflakeTimeReversedStrategy.USE_PREVIOUS_TIME:
                    timeOffset = this._prevTime;
                    break;
            }
        }
        if (this._prevTime !== timeOffset) {
            // this._prevTime = timeOffset;
            this._countPerMs = 0;
            switch (this._onTimeChangedStrategy) {
                case Sf.ESnowflakeSequenceStrategy.RESET:
                    if (this._seq >= this._onTimeChangedResetThreshold) {
                        this._seq = 0;
                    }
                    break;
                case Sf.ESnowflakeSequenceStrategy.KEEP_CURRENT:
                    // do nothing, because the sequence number will be incremented.
                    break;
                default:
                    this._seq = this._onTimeChangedCallback(this._seq);
            }
        }
        else if (this._countPerMs > this.maximumSequence) {
            throw new eL.E_SEQUENCE_OVERFLOWED();
        }
        this._countPerMs++;
        return (timeOffset * this._clockFactor) + this._midPart + (this._seq++ & this.maximumSequence);
    }
    /**
     * Generate a SnowflakeSI ID by specifying the timestamp and sequence number.
     *
     * @param timestamp     The timestamp to use for the ID, must be greater than or equal to the epoch.
     * @param sequence   The sequence number to use for the ID, must be between 0 and the maximum sequence value.
     *
     * @returns A SnowflakeSI ID, which is a 53-bit integer (number type).
     *
     * @throws {E_SEQUENCE_OVERFLOWED} If the sequence number exceeds the maximum value.
     * @throws {E_TIME_BEFORE_EPOCH} If the timestamp is earlier than the epoch.
     */
    generateBy(timestamp, sequence) {
        if (this.epoch > timestamp) {
            throw new eL.E_TIME_BEFORE_EPOCH({ epoch: this.epoch, time: timestamp });
        }
        if (sequence > this.maximumSequence) {
            throw new eL.E_SEQUENCE_OVERFLOWED({ sequence });
        }
        return ((timestamp - this.epoch) * this._clockFactor) + this._midPart + sequence;
    }
}
exports.SnowflakeSiGenerator = SnowflakeSiGenerator;
//# sourceMappingURL=SnowflakeSI.js.map