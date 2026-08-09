"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), {
	ssr: false,
	loading: () => (
		<div className="p-4 text-sm text-slate-500 border rounded-md">
			Loading text editor...
		</div>
	),
});

interface RichTextEditorProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function RichTextEditor({
	value,
	onChange,
	placeholder,
}: RichTextEditorProps) {
	const modules = useMemo(
		() => ({
			toolbar: [
				[{ header: [1, 2, 3, false] }],
				["bold", "italic", "underline", "strike", "blockquote"],
				[
					{ list: "ordered" },
					{ list: "bullet" },
					{ indent: "-1" },
					{ indent: "+1" },
				],
				// FIX: The color and background must be objects to show the dropdown picker
				[{ color: [] }, { background: [] }],
				["link", "clean"],
			],
		}),
		[],
	);

	return (
		// FIX: Removed "overflow-hidden" so the color dropdowns aren't cut off
		<div className="bg-white text-black rounded-md border border-slate-300">
			<ReactQuill
				theme="snow"
				value={value}
				onChange={onChange}
				modules={modules}
				placeholder={placeholder || "Type your lesson content here..."}
				className="lesson-rich-text-editor"
			/>
			{/* This global style ensures Tailwind's CSS reset doesn't break Quill's lists 
        and allows the color picker dropdown to appear over other elements.
      */}
			<style jsx global>{`
				.lesson-rich-text-editor .ql-container {
					min-height: 180px;
				}
				.lesson-rich-text-editor .ql-editor {
					min-height: 180px;
				}
				.ql-editor ul {
					list-style-type: disc !important;
					padding-left: 1.5em !important;
				}
				.ql-editor ol {
					list-style-type: decimal !important;
					padding-left: 1.5em !important;
				}
				.ql-picker-options {
					z-index: 50 !important;
				}
			`}</style>
		</div>
	);
}
