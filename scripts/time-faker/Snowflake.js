"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnowflakeGenerator = exports.SNOWFLAKE_DEFAULT_TIME_CHANGED_STRATEGY = exports.SNOWFLAKE_DEFAULT_TIME_REVERSAL_STRATEGY = exports.ESnowflakeSequenceStrategy = exports.ESnowflakeTimeReversedStrategy = void 0;
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
const eL = require("./Errors");
const NodeTimers = require("node:timers/promises");
const DEFAULT_BULK_OPTIONS = {
    'maxRetries': 3,
    'retryDelayMs': 1,
};
/**
 * The strategy for handling time reversal events in Snowflake ID generation.
 */
var ESnowflakeTimeReversedStrategy;
(function (ESnowflakeTimeReversedStrategy) {
    /**
     * Throw an error to stop the generator from generating IDs.
     *
     * - Pro: Stops ID generation immediately.
     * - Con: Only after the time catches up the previous time again,
     *        the generator can continue to generate IDs.
     */
    ESnowflakeTimeReversedStrategy[ESnowflakeTimeReversedStrategy["THROW_ERROR"] = 0] = "THROW_ERROR";
    /**
     * Use the reversed time as the current time to generate IDs.
     *
     * - Pro: Allows the generator to continue generating IDs immediately.
     * - Con: The generated IDs may not be in the correct order, and the IDs generated
     *        may not be unique if the time is reversed multiple times.
     */
    ESnowflakeTimeReversedStrategy[ESnowflakeTimeReversedStrategy["USE_REVERSED_TIME"] = 1] = "USE_REVERSED_TIME";
    /**
     * Use the previous time as the current time to generate IDs.
     *
     * - Pro: Allows the generator to continue generating IDs immediately,
     *        and the IDs generated will be in the correct order.
     * - Con: The sequence number will run out quickly if the real time does
     *        not catch up with the previous time soon.
     */
    ESnowflakeTimeReversedStrategy[ESnowflakeTimeReversedStrategy["USE_PREVIOUS_TIME"] = 2] = "USE_PREVIOUS_TIME";
})(ESnowflakeTimeReversedStrategy || (exports.ESnowflakeTimeReversedStrategy = ESnowflakeTimeReversedStrategy = {}));
/**
 * How should the generator handle the sequence number when the time changes.
 */
var ESnowflakeSequenceStrategy;
(function (ESnowflakeSequenceStrategy) {
    /**
     * Reset the sequence number to 0 when the time changes.
     *
     * - Pro: The sequence number will not overflow and the IDs generated will always be in the correct order.
     * - Con: The randomness of the IDs will be reduced.
     */
    ESnowflakeSequenceStrategy[ESnowflakeSequenceStrategy["RESET"] = 0] = "RESET";
    /**
     * Keep the sequence number unchanged when the time changes.
     *
     * - Pro: The randomness of the IDs will be preserved.
     * - Con: The sequence number may be reset to 0 if the sequence number overflows,
     *        so the IDs generated in the same millisecond may not be in the correct order.
     */
    ESnowflakeSequenceStrategy[ESnowflakeSequenceStrategy["KEEP_CURRENT"] = 1] = "KEEP_CURRENT";
})(ESnowflakeSequenceStrategy || (exports.ESnowflakeSequenceStrategy = ESnowflakeSequenceStrategy = {}));
/**
 * The default strategy for the time reversal event,
 * which throws an `E_TIME_REVERSED` error.
 */
exports.SNOWFLAKE_DEFAULT_TIME_REVERSAL_STRATEGY = ESnowflakeTimeReversedStrategy.THROW_ERROR;
/**
 * The default strategy for the time changed event,
 * which reset the sequence number to 0.
 */
exports.SNOWFLAKE_DEFAULT_TIME_CHANGED_STRATEGY = ESnowflakeSequenceStrategy.RESET;
const BI_OFFSET_TIMESTAMP = 22n;
const BI_OFFSET_MAC_ID = 12n;
const MAX_SEQUENCE_NUMBER = 4095;
const BI_MAX_SEQUENCE_NUMBER = BigInt(MAX_SEQUENCE_NUMBER);
/**
 * The class for generating Snowflake IDs.
 */
class SnowflakeGenerator {
    /**
     * The strategy for the time reversal event.
     */
    _onTimeReversedStrategy;
    _onTimeChangedCallback;
    _onTimeChangedStrategy;
    _onTimeChangedResetThreshold = 0n;
    /**
     * The minimum machine ID that can be used by the generator.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static MIN_MACHINE_ID = 0;
    /**
     * The maximum machine ID that can be used by the generator.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static MAX_MACHINE_ID = 1023;
    /**
     * The identifier of the machine that generates the UUID.
     *
     * For the snowflake ID of a specific resource, each generator must use a unique machine ID
     * so that the generated IDs will not conflict with each other.
     *
     * @range 0 - 1023
     */
    machineId;
    /**
     * The epoch of the generator.
     *
     * The value is recommended to be the time when the service/application goes online.
     *
     * @default 0
     */
    epoch;
    _biInstId;
    _prevTime = 0;
    _seq = 0n;
    _countPerMs = 0;
    constructor(opts) {
        if (!Number.isInteger(opts.machineId) ||
            opts.machineId < SnowflakeGenerator.MIN_MACHINE_ID ||
            opts.machineId > SnowflakeGenerator.MAX_MACHINE_ID) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'invalid_machine_id',
                'machineId': opts.machineId,
            });
        }
        this.machineId = opts.machineId;
        this.epoch = opts.epoch ?? 0;
        if (typeof this.epoch !== 'number' || !Number.isSafeInteger(this.epoch) || this.epoch < 0) {
            throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                'reason': 'invalid_epoch',
                'epoch': this.epoch,
            });
        }
        this._biInstId = BigInt(opts.machineId) << BI_OFFSET_MAC_ID;
        this._onTimeReversedStrategy = opts.onTimeReversed ?? exports.SNOWFLAKE_DEFAULT_TIME_REVERSAL_STRATEGY;
        switch (opts.onTimeChanged ?? exports.SNOWFLAKE_DEFAULT_TIME_CHANGED_STRATEGY) {
            case ESnowflakeSequenceStrategy.RESET:
                const seqResetThreshold = opts.sequenceResetThreshold ?? 0;
                if (!Number.isInteger(seqResetThreshold) ||
                    seqResetThreshold < 0 ||
                    seqResetThreshold > MAX_SEQUENCE_NUMBER) {
                    throw new eL.E_INVALID_SNOWFLAKE_SETTINGS({
                        'reason': 'invalid_sequence_reset_threshold',
                        'sequenceResetThreshold': seqResetThreshold,
                    });
                }
                this._onTimeChangedStrategy = ESnowflakeSequenceStrategy.RESET;
                this._onTimeChangedResetThreshold = BigInt(seqResetThreshold);
                break;
            case ESnowflakeSequenceStrategy.KEEP_CURRENT:
                this._onTimeChangedStrategy = ESnowflakeSequenceStrategy.KEEP_CURRENT;
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
     * Generate the next Snowflake ID, based on the current time and the next sequence number.
     *
     * @returns A Snowflake ID, which is a 64-bit integer (BigInt).
     *
     * @throws {E_TIME_REVERSED} If the current time is earlier than the previous time.
     * @throws {E_SEQUENCE_OVERFLOWED} If the sequence number exceeds the maximum value.
     * @throws {E_TIME_BEFORE_EPOCH} If the current time is before the epoch.
     */
    generate() {
        const now = Date.now();
        if (now < this.epoch) {
            throw new eL.E_TIME_BEFORE_EPOCH({ epoch: this.epoch, time: now });
        }
        let timeOffset = now - this.epoch;
        if (this._prevTime > timeOffset) {
            switch (this._onTimeReversedStrategy) {
                case ESnowflakeTimeReversedStrategy.THROW_ERROR:
                    throw new eL.E_TIME_REVERSED({
                        previous: this._prevTime + this.epoch,
                        current: timeOffset + this.epoch
                    });
                case ESnowflakeTimeReversedStrategy.USE_REVERSED_TIME:
                    // do nothing, because `timeOffset` is the reversed time.
                    break;
                case ESnowflakeTimeReversedStrategy.USE_PREVIOUS_TIME:
                    timeOffset = this._prevTime;
                    break;
            }
        }
        if (this._prevTime !== timeOffset) {
            // this._prevTime = timeOffset;
            this._countPerMs = 0;
            switch (this._onTimeChangedStrategy) {
                case ESnowflakeSequenceStrategy.RESET:
                    if (this._seq >= this._onTimeChangedResetThreshold) {
                        this._seq = 0n;
                    }
                    break;
                case ESnowflakeSequenceStrategy.KEEP_CURRENT:
                    // do nothing, because the sequence number will be incremented.
                    break;
                default:
                    this._seq = this._onTimeChangedCallback(this._seq);
            }
        }
        else if (this._countPerMs > MAX_SEQUENCE_NUMBER) {
            throw new eL.E_SEQUENCE_OVERFLOWED();
        }
        this._countPerMs++;
        return (BigInt(timeOffset) << BI_OFFSET_TIMESTAMP) + this._biInstId + (this._seq++ & BI_MAX_SEQUENCE_NUMBER);
    }
    /**
     * Generate a Snowflake ID by specifying the timestamp and sequence number.
     *
     * @param timestamp The timestamp to use for the ID.
     * @param sequence The sequence number to use for the ID (0 ~ 4095).
     *
     * @returns A Snowflake ID, which is a 64-bit integer (BigInt).
     *
     * @throws {E_SEQUENCE_OVERFLOWED} If the sequence number exceeds the maximum value.
     * @throws {E_TIME_BEFORE_EPOCH} If the timestamp is before the epoch.
     */
    generateBy(timestamp, sequence) {
        if (sequence > MAX_SEQUENCE_NUMBER) {
            throw new eL.E_SEQUENCE_OVERFLOWED({ sequence });
        }
        if (timestamp < this.epoch) {
            throw new eL.E_TIME_BEFORE_EPOCH({ epoch: this.epoch, time: timestamp });
        }
        return (BigInt(timestamp - this.epoch) << BI_OFFSET_TIMESTAMP) + this._biInstId + BigInt(sequence);
    }
}
exports.SnowflakeGenerator = SnowflakeGenerator;
//# sourceMappingURL=Snowflake.js.map