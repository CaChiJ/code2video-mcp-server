import { Tool } from "@modelcontextprotocol/sdk/types.js";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";

export const REACT_TO_VIDEO_TOOL: Tool = {
  name: "react_code_to_video",
  description: "convert react code to video",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "react code using remotion library",
      },
      width: {
        type: "number",
        description: "width of the video",
      },
      height: {
        type: "number",
        description: "height of the video",
      },
      duration: {
        type: "number",
        description: "duration of the video",
      },
      fps: {
        type: "number",
        description: "fps of the video",
        default: 30,
      },
    },
    required: ["code", "width", "height", "duration"],
  },
};

export const reactToVideoTool = async (args: {
  code: string;
  width: number;
  height: number;
  duration: number;
  fps?: number;
}) => {
  const { code, width, height, duration, fps = 30 } = args;

  // create a video file using remotion library
  const video = await renderVideo({
    code,
    width,
    height,
    duration,
    fps,
  });

  return video;
};

export function isReactToVideoToolArgs(args: unknown): args is {
  code: string;
  width: number;
  height: number;
  duration: number;
  fps?: number;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "code" in args &&
    "width" in args &&
    "height" in args &&
    "duration" in args &&
    typeof (args as { code: string }).code === "string" &&
    typeof (args as { width: number }).width === "number" &&
    typeof (args as { height: number }).height === "number" &&
    typeof (args as { duration: number }).duration === "number"
  );
}

async function renderVideo(args: {
  code: string;
  width: number;
  height: number;
  duration: number; // 밀리초 단위
  fps: number;
}): Promise<string> {
  const { code, width, height, duration, fps } = args;
  // 임시 Remotion 프로젝트를 위한 디렉터리 생성
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-project-"));
  const srcDir = path.join(tmpDir, "src");
  await fs.mkdir(srcDir);

  // package.json 파일 작성
  const packageJson = {
    name: "remotion-video",
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: {
      remotion: "^3.0.0",
      react: "^18.0.0",
      "react-dom": "^18.0.0",
    },
  };
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
    "utf-8"
  );

  // tsconfig.json 파일 작성
  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      jsx: "react-jsx",
      strict: true,
      moduleResolution: "node",
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src"],
  };
  await fs.writeFile(
    path.join(tmpDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
    "utf-8"
  );

  // src/index.ts 작성: Root를 등록
  const indexTs = `
    import {registerRoot} from 'remotion';
    import {Root} from './Root';
    registerRoot(Root);
  `;
  await fs.writeFile(path.join(srcDir, "index.ts"), indexTs, "utf-8");

  // 전달된 duration은 밀리초 단위이므로, 프레임 수로 변환 (fps 기준)
  const durationInFrames = Math.ceil((duration / 1000) * fps);

  // src/Root.tsx 작성: Composition 설정 (기본 id는 "MyComp")
  const rootTsx = `
    import React from 'react';
    import {Composition} from 'remotion';
    import {MyComponent} from './MyComponent';

    export const Root: React.FC = () => {
      return (
        <>
          <Composition
            id="MyComp"
            component={MyComponent}
            durationInFrames={${durationInFrames}}
            width={${width}}
            height={${height}}
            fps={${fps}}
            defaultProps={{}}
          />
        </>
      );
    };
  `;
  await fs.writeFile(path.join(srcDir, "Root.tsx"), rootTsx, "utf-8");

  // src/MyComponent.tsx 작성: 전달된 React 코드 삽입
  await fs.writeFile(path.join(srcDir, "MyComponent.tsx"), code, "utf-8");

  // Remotion 번들링: entry 파일은 src/index.ts
  const entryPoint = path.join(srcDir, "index.ts");
  const bundleLocation = await bundle(entryPoint, undefined, {
    // 필요에 따라 추가 옵션을 설정할 수 있습니다.
  });

  // 출력 파일 경로 설정 (임시 디렉터리 내에 output.mp4 생성)
  const outputPath = path.join(tmpDir, "output.mp4");

  // 영상 렌더링: composition id는 "MyComp"
  await renderMedia({
    composition: {
      id: "MyComp",
      width: width,
      height: height,
      fps: fps,
      durationInFrames: durationInFrames,
      defaultProps: {},        // 기본 프롭스 (필요시 실제 값을 넣으세요)
      props: {},               // 컴포넌트 프롭스 (필요시 실제 값을 넣으세요)
      defaultCodec: 'h264',    // 기본 코덱
      defaultOutName: 'output' // 기본 출력 파일 이름 (예: "output")
    },
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
  });

  // 렌더링 완료 후 출력 영상 파일 경로 반환
  return outputPath;
}
