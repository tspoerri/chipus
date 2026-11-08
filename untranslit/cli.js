#!/usr/bin/env node
import fs from 'node:fs';
import { convertText } from './convert.js';
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(convertText(input));
