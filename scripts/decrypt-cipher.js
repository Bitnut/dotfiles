#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function printUsage() {

    console.log(`
Usage:
  node tools/scripts/decrypt-cipher.js --cipher-text <value> --cipher-suite <value> --config '<json>'
  node tools/scripts/decrypt-cipher.js --input-file <path> --config-file <path>
  node tools/scripts/decrypt-cipher.js --cipher-text-file <path> --cipher-suite-file <path> --config-file <path>
  node tools/scripts/decrypt-cipher.js --cipher-text <value> --cipher-suite <value> --config-file <path>

Options:
  --cipher-text, -t             Cipher text string.
  --cipher-suite, -s            Cipher suite string, e.g. "kid=k20240729;alg=aes-256-cfb;iv=..."
  --input-file                  Path to JSON file containing cipherText and cipherSuite.
  --cipher-text-file            Path to cipher text file.
  --cipher-suite-file           Path to cipher suite file.
  --config, -c                  Config JSON string.
  --config-file, -f             Path to config JSON file.
  --profile, -p                Symmetric cipher profile name. Default: "default"
  --cipher-text-encoding, -e    Cipher text encoding: auto | base64 | hex | utf8 | binary. Default: auto
  --help, -h                    Show this message.

Examples:
  node tools/scripts/decrypt-cipher.js \\
    --input-file ./cipher-input.json \\
    --config-file ./config.json \\
    --cipher-text-encoding base64

  node tools/scripts/decrypt-cipher.js \\
    --cipher-text 'BASE64_CIPHER_TEXT' \\
    --cipher-text-encoding base64 \\
    --cipher-suite 'kid=k20240729;alg=aes-256-cfb;iv=xxxxxxxxxxxxxxxxxxxxxx==' \\
    --config-file ./config.json
`.trim());
}

function parseArgs(argv) {

    const ret = {
        profile: 'default',
        cipherTextEncoding: 'auto',
    };

    for (let i = 0; i < argv.length; i++) {

        const arg = argv[i];

        switch (arg) {

            case '--cipher-text':
            case '-t':
                ret.cipherText = argv[++i];
                break;

            case '--cipher-suite':
            case '-s':
                ret.cipherSuite = argv[++i];
                break;

            case '--input-file':
                ret.inputFile = argv[++i];
                break;

            case '--cipher-text-file':
                ret.cipherTextFile = argv[++i];
                break;

            case '--cipher-suite-file':
                ret.cipherSuiteFile = argv[++i];
                break;

            case '--config':
            case '-c':
                ret.config = argv[++i];
                break;

            case '--config-file':
            case '-f':
                ret.configFile = argv[++i];
                break;

            case '--profile':
            case '-p':
                ret.profile = argv[++i];
                break;

            case '--cipher-text-encoding':
            case '-e':
                ret.cipherTextEncoding = argv[++i];
                break;

            case '--help':
            case '-h':
                ret.help = true;
                break;

            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return ret;
}

function readConfig(args) {

    if (args.config && args.configFile) {

        throw new Error('Only one of --config or --config-file can be provided.');
    }

    if (args.config) {

        return JSON.parse(args.config);
    }

    if (args.configFile) {

        const filePath = path.resolve(args.configFile);

        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    throw new Error('Missing config. Provide --config or --config-file.');
}

function readTextFile(filePath) {

    return fs.readFileSync(path.resolve(filePath), 'utf8').trim();
}

function readInputFile(filePath) {

    const content = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));

    if (!content || typeof content !== 'object') {

        throw new Error('Input file must be a JSON object.');
    }

    if (typeof content.cipherText !== 'string' || !content.cipherText.trim()) {

        throw new Error('Input file is missing string field: cipherText');
    }

    if (typeof content.cipherSuite !== 'string' || !content.cipherSuite.trim()) {

        throw new Error('Input file is missing string field: cipherSuite');
    }

    return {
        cipherText: content.cipherText.trim(),
        cipherSuite: content.cipherSuite.trim(),
    };
}

function deserializeCipherSuite(cipherSuite) {

    const ret = {};

    for (const item of cipherSuite.split(';')) {

        const equalPos = item.indexOf('=');

        if (equalPos === -1) {

            throw new Error(`Invalid cipherSuite item: ${item}`);
        }

        ret[item.slice(0, equalPos)] = item.slice(equalPos + 1);
    }

    return ret;
}

function isHexString(input) {

    return /^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0;
}

function isBase64String(input) {

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 !== 0) {

        return false;
    }

    try {

        return Buffer.from(input, 'base64').toString('base64') === input;
    }
    catch {

        return false;
    }
}

function decodeCipherText(cipherText, encoding) {

    switch (encoding) {

        case 'base64':
            return Buffer.from(cipherText, 'base64');

        case 'hex':
            return Buffer.from(cipherText, 'hex');

        case 'utf8':
            return Buffer.from(cipherText, 'utf8');

        case 'binary':
            return Buffer.from(cipherText, 'binary');

        case 'auto':
            if (isHexString(cipherText)) {

                return Buffer.from(cipherText, 'hex');
            }

            if (isBase64String(cipherText)) {

                return Buffer.from(cipherText, 'base64');
            }

            // Prefer binary over utf8 for non-ASCII text to preserve raw byte values
            // from strings that originated from Buffer#toString('binary').
            if (/[^\x00-\x7F]/.test(cipherText)) {

                return Buffer.from(cipherText, 'binary');
            }

            return Buffer.from(cipherText, 'utf8');

        default:
            throw new Error(`Unsupported cipher text encoding: ${encoding}`);
    }
}

function getProfile(config, profileName) {

    const profile = config?.cipher?.symmetricCiphers?.[profileName];

    if (!profile) {

        throw new Error(`Symmetric cipher profile not found: ${profileName}`);
    }

    return profile;
}

function decryptCipherText(cipherText, cipherSuite, profile) {

    const { kid, alg, iv } = deserializeCipherSuite(cipherSuite);
    const keyConfig = profile.keys?.[kid];

    if (!keyConfig) {

        throw new Error(`Key not found in profile: ${kid}`);
    }

    if (keyConfig.algorithm !== alg) {

        throw new Error(
            `Algorithm mismatch. cipherSuite=${alg}, config=${keyConfig.algorithm}`
        );
    }

    const decipher = crypto.createDecipheriv(
        keyConfig.algorithm,
        Buffer.from(keyConfig.key, 'base64'),
        Buffer.from(iv, 'base64')
    );

    return Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
    ]);
}

function formatOutput(plaintext) {

    const text = plaintext.toString('utf8');

    try {

        return JSON.stringify(JSON.parse(text), null, 2);
    }
    catch {

        return text;
    }
}

function main() {

    const args = parseArgs(process.argv.slice(2));

    if (args.help) {

        printUsage();
        return;
    }

    if (args.inputFile && (
        args.cipherText ||
        args.cipherSuite ||
        args.cipherTextFile ||
        args.cipherSuiteFile
    )) {

        throw new Error(
            '--input-file cannot be used together with cipher text / cipher suite direct or file arguments.'
        );
    }

    if (args.cipherText && args.cipherTextFile) {

        throw new Error('Only one of --cipher-text or --cipher-text-file can be provided.');
    }

    if (args.cipherSuite && args.cipherSuiteFile) {

        throw new Error('Only one of --cipher-suite or --cipher-suite-file can be provided.');
    }

    if (!args.inputFile && !args.cipherText && !args.cipherTextFile) {

        throw new Error('Missing cipher text. Provide --input-file, --cipher-text or --cipher-text-file.');
    }

    if (!args.inputFile && !args.cipherSuite && !args.cipherSuiteFile) {

        throw new Error('Missing cipher suite. Provide --input-file, --cipher-suite or --cipher-suite-file.');
    }

    const config = readConfig(args);
    const profile = getProfile(config, args.profile);
    const input = args.inputFile
        ? readInputFile(args.inputFile)
        : {
            cipherText: args.cipherTextFile
                ? readTextFile(args.cipherTextFile)
                : args.cipherText,
            cipherSuite: args.cipherSuiteFile
                ? readTextFile(args.cipherSuiteFile)
                : args.cipherSuite,
        };
    const cipherTextInput = input.cipherText;
    const cipherSuiteInput = input.cipherSuite;
    const cipherText = decodeCipherText(cipherTextInput, args.cipherTextEncoding);
    const plaintext = decryptCipherText(cipherText, cipherSuiteInput, profile);

    console.log(formatOutput(plaintext));
}

try {

    main();
}
catch (e) {

    console.error(`[decrypt-cipher] ${e.message}`);
    process.exitCode = 1;
}

