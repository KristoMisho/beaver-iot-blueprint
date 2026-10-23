/**
 * Payload Decoder for NB-IoT Device
 *
 * Copyright 2024 Milesight IoT
 *
 * @product UC50x

/* eslint no-redeclare: "off" */
/* eslint-disable-next-line */
function decodePayload(bytes) {
    var buffer = new Buffer(bytes);

    var payload = {};
    payload.startFlag = buffer.readUInt8();
    payload.id = buffer.readUInt16BE();
    payload.length = buffer.readUInt16BE();
    payload.flag = buffer.readUInt8();
    payload.frameCnt = buffer.readUInt16BE();
    payload.protocolVersion = buffer.readUInt8();
    payload.firmwareVersion = buffer.readAscii(4);
    payload.hardwareVersion = buffer.readAscii(4);
    payload.sn = buffer.readAscii(16);
    payload.imei = buffer.readAscii(15);
    payload.imsi = buffer.readAscii(15);
    payload.iccid = buffer.readAscii(20);
    payload.csq = buffer.readUInt8();
    payload.data_length = buffer.readUInt16BE();
    payload.data = decodeSensorData(buffer.slice(payload.data_length));

    return payload;
}

var gpio_chns = [0x03, 0x04];
var ai_chns = [0x05, 0x06];
var ai_alarm_chns = [0x85, 0x86];
var ai_mutation_alarm_chns = [0x95, 0x96];
var ai_error_chns = [0xb5, 0xb6];

function decodeSensorData(bytes) {
    var history = [];

    var decoded = {};
    var repack_flag = false;
    var buffer = new Buffer(bytes);
    while (buffer.remaining() > 0) {
        var channel_id = buffer.readUInt8();
        var channel_type = buffer.readUInt8();

        // set repack_flag to false when the end of the packet is reached
        if (repack_flag === true && ((channel_id === 0x07 && channel_type === 0xef) || (channel_id === 0x20 && channel_type === 0xef))) {
            history.push(decoded);

            repack_flag = false;
            decoded = {};
        }

        // BATTERY
        if (channel_id === 0x01 && channel_type === 0x75) {
            decoded.battery = buffer.readUInt8();
        }
        // GPIO DIGITAL INPUT
        else if (includes(gpio_chns, channel_id) && channel_type === 0x00) {
            var gpio_channel_name = "gpio_input_" + (channel_id - gpio_chns[0] + 1);
            decoded[gpio_channel_name] = buffer.readUInt8() === 0 ? "low" : "high";
        }
        // GPIO DIGITAL OUTPUT
        else if (includes(gpio_chns, channel_id) && channel_type === 0x01) {
            var gpio_channel_name = "gpio_output_" + (channel_id - gpio_chns[0] + 1);
            decoded[gpio_channel_name] = buffer.readUInt8() === 0 ? "low" : "high";
        }
        // GPIO COUNTER
        else if (includes(gpio_chns, channel_id) && channel_type === 0xc8) {
            var gpio_channel_name = "gpio_counter_" + (channel_id - gpio_chns[0] + 1);
            decoded[gpio_channel_name] = buffer.readUInt32LE();
        }
        // ANALOG INPUT
        else if (includes(ai_chns, channel_id) && channel_type === 0xf1) {
            var mode = buffer.readUInt8();
            var ai_mode = (mode & 0x01) === 1 ? "voltage" : "current";
            var ai_value_mode = ((mode >> 1) & 0x01) === 1 ? "multiple" : "single";
            var ai_data_type = ((mode >> 2) & 0x01) === 1 ? "float16" : "float32";

            var ai_chn_name;
            if (ai_mode === "voltage") {
                ai_chn_name = "adv_" + (channel_id - ai_chns[0] + 1);
            } else {
                ai_chn_name = "adc_" + (channel_id - ai_chns[0] + 1);
            }

            if (ai_data_type === "float16") {
                decoded[ai_chn_name] = buffer.readFloat16LE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloat16LE();
                }
            } else {
                decoded[ai_chn_name] = buffer.readFloatLE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloatLE();
                }
            }
        }
        // ANALOG INPUT THRESHOLD ALARM
        else if (includes(ai_alarm_chns, channel_id) && channel_type === 0xf1) {
            var mode = buffer.readUInt8();
            var ai_mode = (mode & 0x01) === 1 ? "voltage" : "current";
            var ai_value_mode = ((mode >> 1) & 0x01) === 1 ? "multiple" : "single";
            var ai_data_type = ((mode >> 2) & 0x01) === 1 ? "float16" : "float32";

            var ai_chn_name;
            if (ai_mode === "voltage") {
                ai_chn_name = "adv_" + (channel_id - ai_alarm_chns[0] + 1);
            } else {
                ai_chn_name = "adc_" + (channel_id - ai_alarm_chns[0] + 1);
            }

            if (ai_data_type === "float16") {
                decoded[ai_chn_name] = buffer.readFloat16LE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloat16LE();
                }
            } else {
                decoded[ai_chn_name] = buffer.readFloatLE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloatLE();
                }
            }

            decoded[ai_chn_name + "_alarm"] = buffer.readUInt8() === 1 ? "threshold alarm" : "threshold alarm release";

            // pack
            history.push(decoded);
            if ("timestamp" in decoded && buffer.remaining()) {
                decoded = { timestamp: decoded.timestamp };
            } else {
                decoded = {};
            }
        }
        // ANALOG INPUT MUTATION ALARM
        else if (includes(ai_mutation_alarm_chns, channel_id) && channel_type === 0xf1) {
            var mode = buffer.readUInt8();
            var ai_mode = (mode & 0x01) === 1 ? "voltage" : "current";
            var ai_value_mode = ((mode >> 1) & 0x01) === 1 ? "multiple" : "single";
            var ai_data_type = ((mode >> 2) & 0x01) === 1 ? "float16" : "float32";

            var ai_chn_name;
            if (ai_mode === "voltage") {
                ai_chn_name = "adv_" + (channel_id - ai_mutation_alarm_chns[0] + 1);
            } else {
                ai_chn_name = "adc_" + (channel_id - ai_mutation_alarm_chns[0] + 1);
            }

            if (ai_data_type === "float16") {
                decoded[ai_chn_name] = buffer.readFloat16LE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloat16LE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloat16LE();
                }
                decoded[ai_chn_name + "_mutation"] = buffer.readFloat16LE();
            } else {
                decoded[ai_chn_name] = buffer.readFloatLE();
                if (ai_value_mode === "multiple") {
                    decoded[ai_chn_name + "_min"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_max"] = buffer.readFloatLE();
                    decoded[ai_chn_name + "_avg"] = buffer.readFloatLE();
                }
                decoded[ai_chn_name + "_mutation"] = buffer.readFloatLE();
            }

            decoded[ai_chn_name + "_alarm"] = buffer.readUInt8() === 0 ? "mutation alarm" : "unknown";

            // pack
            history.push(decoded);
            if ("timestamp" in decoded && buffer.remaining()) {
                decoded = { timestamp: decoded.timestamp };
            } else {
                decoded = {};
            }
        }
        // ANALOG INPUT ERROR
        else if (includes(ai_error_chns, channel_id) && channel_type === 0xf1) {
            var error_type = buffer.readUInt8();

            var ai_chn_name = "ai_" + (channel_id - ai_error_chns[0] + 1);
            switch (error_type) {
                case 0x00:
                    decoded[ai_chn_name + "_error"] = "read error";
                    break;
                case 0x01:
                    decoded[ai_chn_name + "_error"] = "overload";
                    break;
                default:
                    decoded[ai_chn_name + "_error"] = "unknown";
                    break;
            }
        }
        // TIMESTAMP
        else if ((channel_id === 0x07 && channel_type === 0xef) || (channel_id === 0x20 && channel_type === 0xef)) {
            decoded.timestamp = buffer.readUInt32LE();
            repack_flag = true;
        }
        // SDI-12
        else if (channel_id === 0x08 && channel_type === 0xf2) {
            var sdi_chn_id = buffer.readUInt8() + 1;
            var sdi_data_length = buffer.readUInt8();
            if (sdi_data_length !== 0) {
                var sdi_chn_name = "sdi_chn_" + sdi_chn_id;
                decoded[sdi_chn_name] = buffer.readAscii(sdi_data_length);
            }
        }
        // SDI-12 ERROR
        else if (channel_id === 0xb8 && channel_type === 0xf2) {
            var sdi_chn_id = buffer.readUInt8() + 1;
            var error_type = buffer.readUInt8();

            var sdi_chn_name = "sdi_chn_" + sdi_chn_id;
            switch (error_type) {
                case 0x00:
                    decoded[sdi_chn_name + "_error"] = "read error";
                    break;
                case 0x01:
                    decoded[sdi_chn_name + "_error"] = "overload";
                    break;
                default:
                    decoded[sdi_chn_name + "_error"] = "unknown";
                    break;
            }
        }
        // MODBUS
        else if (channel_id === 0x09 && channel_type === 0xf3) {
            var modbus_chn_id = buffer.readUInt8() + 1;
            var modbus_chn_definition = buffer.readUInt8();
            var sign = (modbus_chn_definition >> 7) & 0x01;
            var modbus_chn_data_type = modbus_chn_definition & 0x0f;
            var modbus_chn_name = "modbus_chn_" + modbus_chn_id;

            switch (modbus_chn_data_type) {
                case 0:
                case 1:
                    decoded[modbus_chn_name] = buffer.readUInt8();
                    break;
                case 2:
                case 3:
                    decoded[modbus_chn_name] = sign ? buffer.readInt16LE() : buffer.readUInt16LE();
                    break;
                case 4:
                case 6:
                    decoded[modbus_chn_name] = sign ? buffer.readInt32LE() : buffer.readUInt32LE();
                    break;
                case 5:
                case 7:
                    decoded[modbus_chn_name] = buffer.readFloatLE();
                    break;
                default:
                    break;
            }
        }
        // MODBUS THRESHOLD ALARM
        else if (channel_id === 0x89 && channel_type === 0xf3) {
            var modbus_chn_id = buffer.readUInt8() + 1;
            var modbus_chn_definition = buffer.readUInt8();
            var sign = (modbus_chn_definition >> 7) & 0x01;
            var modbus_chn_data_type = modbus_chn_definition & 0x0f;
            var modbus_chn_name = "modbus_chn_" + modbus_chn_id;

            switch (modbus_chn_data_type) {
                case 0:
                case 1:
                    decoded[modbus_chn_name] = buffer.readUInt8();
                    break;
                case 2:
                case 3:
                    decoded[modbus_chn_name] = sign ? buffer.readInt16LE() : buffer.readUInt16LE();
                    break;
                case 4:
                case 6:
                    decoded[modbus_chn_name] = sign ? buffer.readInt32LE() : buffer.readUInt32LE();
                    break;
                case 5:
                case 7:
                    decoded[modbus_chn_name] = buffer.readFloatLE();
                    break;
                default:
                    break;
            }

            decoded[modbus_chn_name + "_alarm"] = buffer.readUInt8() === 1 ? "threshold alarm" : "threshold alarm release";

            // pack
            history.push(decoded);
            if ("timestamp" in decoded && buffer.remaining()) {
                decoded = { timestamp: decoded.timestamp };
            } else {
                decoded = {};
            }
        }
        // MODBUS MUTATION ALARM
        else if (channel_id === 0x99 && channel_type === 0xf3) {
            var modbus_chn_id = buffer.readUInt8() + 1;
            var modbus_chn_definition = buffer.readUInt8();
            var sign = (modbus_chn_definition >> 7) & 0x01;
            var modbus_chn_data_type = modbus_chn_definition & 0x0f;
            var modbus_chn_name = "modbus_chn_" + modbus_chn_id;

            switch (modbus_chn_data_type) {
                case 0:
                case 1:
                    decoded[modbus_chn_name] = buffer.readUInt8();
                    decoded[modbus_chn_name + "_mutation"] = buffer.readUInt8();
                    break;
                case 2:
                case 3:
                    decoded[modbus_chn_name] = sign ? buffer.readInt16LE() : buffer.readUInt16LE();
                    decoded[modbus_chn_name + "_mutation"] = sign ? buffer.readInt16LE() : buffer.readUInt16LE();
                    break;
                case 4:
                case 6:
                    decoded[modbus_chn_name] = sign ? buffer.readInt32LE() : buffer.readUInt32LE();
                    decoded[modbus_chn_name + "_mutation"] = sign ? buffer.readInt32LE() : buffer.readUInt32LE();
                    break;
                case 5:
                case 7:
                    decoded[modbus_chn_name] = buffer.readFloatLE();
                    decoded[modbus_chn_name + "_mutation"] = buffer.readFloatLE();
                    break;
                default:
                    break;
            }

            decoded[modbus_chn_name + "_alarm"] = buffer.readInt8() === 0 ? "mutation alarm" : "unknown";

            // pack
            history.push(decoded);
            if ("timestamp" in decoded && buffer.remaining()) {
                decoded = { timestamp: decoded.timestamp };
            } else {
                decoded = {};
            }
        }
        // MODBUS ERROR
        else if (channel_id === 0xb9 && channel_type === 0xf3) {
            var modbus_chn_id = buffer.readUInt8() + 1;
            var error_type = buffer.readUInt8();

            var modbus_chn_name = "modbus_chn_" + modbus_chn_id;
            switch (error_type) {
                case 0x00:
                    decoded[modbus_chn_name + "_error"] = "read error";
                    break;
                case 0x01:
                    decoded[modbus_chn_name + "_error"] = "overload";
                    break;
                default:
                    decoded[modbus_chn_name + "_error"] = "unknown";
                    break;
            }
        } else {
            break;
        }
    }

    if (Object.keys(decoded).length !== 0) {
        history.push(decoded);
    }
    return history;
}

function Buffer(bytes) {
    this.bytes = bytes;
    this.length = bytes.length;
    this.offset = 0;
}

Buffer.prototype.readUInt8 = function () {
    var value = this.bytes[this.offset];
    this.offset += 1;
    return value & 0xff;
};

Buffer.prototype.readInt8 = function () {
    var value = this.readUInt8();
    return value > 0x7f ? value - 0x100 : value;
};

Buffer.prototype.readUInt16LE = function () {
    var value = (this.bytes[this.offset + 1] << 8) + this.bytes[this.offset];
    this.offset += 2;
    return value & 0xffff;
};

Buffer.prototype.readInt16LE = function () {
    var value = this.readUInt16LE();
    return value > 0x7fff ? value - 0x10000 : value;
};

Buffer.prototype.readUInt16BE = function () {
    var value = (this.bytes[this.offset] << 8) + this.bytes[this.offset + 1];
    this.offset += 2;
    return value & 0xffff;
};

Buffer.prototype.readInt16BE = function () {
    var value = this.readUIntBE();
    return value > 0x7fff ? value - 0x10000 : value;
};

Buffer.prototype.readUInt32LE = function () {
    var value = (this.bytes[this.offset + 3] << 24) + (this.bytes[this.offset + 2] << 16) + (this.bytes[this.offset + 1] << 8) + this.bytes[this.offset];
    this.offset += 4;
    return (value & 0xffffffff) >>> 0;
};

Buffer.prototype.readInt32LE = function () {
    var value = this.readUInt32LE();
    return value > 0x7fffffff ? value - 0x100000000 : value;
};

Buffer.prototype.readFloat16LE = function () {
    var bits = this.readUInt16LE();
    var sign = bits >>> 15 === 0 ? 1.0 : -1.0;
    var e = (bits >>> 10) & 0x1f;
    var m = e === 0 ? (bits & 0x3ff) << 1 : (bits & 0x3ff) | 0x400;
    var f = sign * m * Math.pow(2, e - 25);
    var v = Number(f.toFixed(2));
    return v;
};

Buffer.prototype.readFloatLE = function () {
    var value = this.readUInt32LE();
    var sign = value >>> 31 === 0 ? 1.0 : -1.0;
    var e = (value >>> 23) & 0xff;
    var m = e === 0 ? (value & 0x7fffff) << 1 : (value & 0x7fffff) | 0x800000;
    var f = sign * m * Math.pow(2, e - 150);
    var v = Number(f.toFixed(2));
    return v;
};

Buffer.prototype.readAscii = function (length) {
    var end = length;
    for (var i = 0; i < length; i++) {
        if (this.bytes[this.offset + i] === 0) {
            end = i;
            break;
        }
    }

    var str = String.fromCharCode.apply(null, this.bytes.slice(this.offset, this.offset + end));
    this.offset += length;
    return str;
};

Buffer.prototype.slice = function (length) {
    return this.bytes.slice(this.offset, this.offset + length);
};

Buffer.prototype.remaining = function () {
    return this.bytes.length - this.offset;
};

function includes(items, item) {
    var size = items.length;
    for (var i = 0; i < size; i++) {
        if (items[i] == item) {
            return true;
        }
    }
    return false;
}
function versionString(s) {
    var major = parseInt(String(s).substring(0, 2), 10);
    var minor = parseInt(String(s).substring(2, 4), 10);
    if (isNaN(major) || isNaN(minor)) return String(s);
    return "V" + major + "." + minor;
}

// Beaver IoT entry point
function Decode(fPort, bytes) {
    var p = decodePayload(bytes);
    var out = {};

    out.device_id = p.sn;
    out.sn = p.sn;
    out.firmware_version = versionString(p.firmwareVersion);
    out.hardware_version = versionString(p.hardwareVersion);

    // più report nello stesso pacchetto: dal più vecchio al più recente
    var records = p.data.slice(0);
    records.sort(function (a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

    var sdi = {};
    for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        for (var key in rec) {
            var v = rec[key];
            var m;

            if (key === "battery") {
                out.battery = v;
            } else if ((m = /^gpio_(input|output)_(\d+)$/.exec(key))) {
                out[key] = v === "high";
            } else if (/^gpio_counter_\d+$/.test(key)) {
                out[key] = v;
            } else if ((m = /^(adc|adv)_(\d+)_alarm$/.exec(key))) {
                if (v === "threshold alarm") out["analog_input_" + m[2] + "_alarm"] = 1;
                else if (v === "mutation alarm") out["analog_input_" + m[2] + "_alarm"] = 2;
            } else if ((m = /^(adc|adv)_(\d+)(_min|_max|_avg)?$/.exec(key))) {
                out["analog_input_" + m[2] + (m[3] || "")] = v;
                if (!m[3]) out["analog_input_" + m[2] + "_type"] = m[1] === "adc" ? 0 : 1;
            } else if ((m = /^sdi_chn_(\d+)$/.exec(key))) {
                sdi[m[1]] = String(v).replace(/^\s+|\s+$/g, "");
            } else if (/^modbus_chn_\d+$/.test(key)) {
                out[key] = v;
            }
        }
    }

    var sdiParts = [];
    for (var ch in sdi) sdiParts.push(ch + ":" + sdi[ch]);
    if (sdiParts.length > 0) out.sid12 = sdiParts.join(" | ");

    return out;
}

// Il downlink non è supportato dal protocollo LTE via UDP: niente da codificare.
function Encode(fPort, obj) {
    return [];
}
