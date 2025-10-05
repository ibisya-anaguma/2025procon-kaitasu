import { NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const SCRIPT_PATH = path.resolve(
	process.cwd(),
	'src/app/api/combos/combination.py'
);
const execAsync = promisify(exec);

export async function POST(_req: Request) {
	try {
		const command = `python3 ${SCRIPT_PATH}`
		const { stdout, stderr } = await execAsync(command);

		if (stderr) {
			return NextResponse.json(
				{ error: 'Checkout script failed.', details: stderr.trim() },
			);
		}
		return NextResponse.json({
			msg: 'success',
		});

	} catch (e: any) { 
		// return NextResponse.json(
		// 	{ error: 'Python script not found' },
		// 	{ status: 500 }
		// );

		return NextResponse.json(
			{
				error: 'exec-failed',
				message: e?.message || String(e),
				code: e?.code,
				cmd: e?.cmd,
				killed: e?.killed,
				signal: e?.signal,
				stdout: e?.stdout?.toString?.(),
				stderr: e?.stderr?.toString?.(),
			},
			{ status: 500 }
		);
	}
}
