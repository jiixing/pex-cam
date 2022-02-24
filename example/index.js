import {
  perspective as createPerspectiveCamera,
  orthographic as createOrthographicCamera,
  orbiter as createOrbiter,
} from "../index.js";

import createContext from "pex-context";
import createCube from "primitive-cube";
import { mat4 } from "pex-math";
import random from "pex-random";
import createGUI from "pex-gui";

const canvas = document.createElement("canvas");
document.querySelector("main").appendChild(canvas);

const ctx = createContext({ canvas: canvas });
const gui = createGUI(ctx);
const cube = createCube(0.2);

const State = { distance: 5, fov: Math.PI / 3 };

const perspectiveCamera = createPerspectiveCamera({
  position: [2, 2, 2],
  target: [0, -0.5, 0],
});

const orthographicCamera = createOrthographicCamera({
  position: [2, 2, 2],
  target: [0, -0.5, 0],
});

const perspectiveOrbiter = createOrbiter({
  camera: perspectiveCamera,
});
const orthographicOrbiter = createOrbiter({
  camera: orthographicCamera,
});

const clearCmd = {
  pass: ctx.pass({
    clearColor: [0.1, 0.1, 0.1, 1],
    clearDepth: 1,
  }),
};

random.seed("0");
const offsets = Array.from({ length: 200 }, () => random.vec3());

const drawCubeCmd = {
  pipeline: ctx.pipeline({
    vert: /* glsl */ `
    attribute vec3 aPosition;
    attribute vec3 aOffset;
    attribute vec3 aNormal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    varying vec3 vNormal;

    mat4 transpose(mat4 m) {
      return mat4(m[0][0], m[1][0], m[2][0], m[3][0],
                  m[0][1], m[1][1], m[2][1], m[3][1],
                  m[0][2], m[1][2], m[2][2], m[3][2],
                  m[0][3], m[1][3], m[2][3], m[3][3]);
    }

    mat4 inverse(mat4 m) {
      float
          a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
          a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
          a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
          a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],

          b00 = a00 * a11 - a01 * a10,
          b01 = a00 * a12 - a02 * a10,
          b02 = a00 * a13 - a03 * a10,
          b03 = a01 * a12 - a02 * a11,
          b04 = a01 * a13 - a03 * a11,
          b05 = a02 * a13 - a03 * a12,
          b06 = a20 * a31 - a21 * a30,
          b07 = a20 * a32 - a22 * a30,
          b08 = a20 * a33 - a23 * a30,
          b09 = a21 * a32 - a22 * a31,
          b10 = a21 * a33 - a23 * a31,
          b11 = a22 * a33 - a23 * a32,

          det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

      return mat4(
          a11 * b11 - a12 * b10 + a13 * b09,
          a02 * b10 - a01 * b11 - a03 * b09,
          a31 * b05 - a32 * b04 + a33 * b03,
          a22 * b04 - a21 * b05 - a23 * b03,
          a12 * b08 - a10 * b11 - a13 * b07,
          a00 * b11 - a02 * b08 + a03 * b07,
          a32 * b02 - a30 * b05 - a33 * b01,
          a20 * b05 - a22 * b02 + a23 * b01,
          a10 * b10 - a11 * b08 + a13 * b06,
          a01 * b08 - a00 * b10 - a03 * b06,
          a30 * b04 - a31 * b02 + a33 * b00,
          a21 * b02 - a20 * b04 - a23 * b00,
          a11 * b07 - a10 * b09 - a12 * b06,
          a00 * b09 - a01 * b07 + a02 * b06,
          a31 * b01 - a30 * b03 - a32 * b00,
          a20 * b03 - a21 * b01 + a22 * b00) / det;
    }

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      mat3 normalMatrix = mat3(transpose(inverse(modelViewMatrix)));
      vNormal = normalMatrix * aNormal;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition + aOffset, 1.0);
    }
  `,
    frag: /* glsl */ `
    precision highp float;

    varying vec3 vNormal;

    void main () {
      gl_FragColor.rgb = vNormal * 0.5 + 0.5;
      gl_FragColor.a = 1.0;
    }
  `,
    depthTest: true,
  }),
  attributes: {
    aPosition: ctx.vertexBuffer(cube.positions),
    aNormal: ctx.vertexBuffer(cube.normals),
    aOffset: { buffer: ctx.vertexBuffer(offsets), divisor: 1 },
  },
  instances: offsets.length,
  indices: ctx.indexBuffer(cube.cells),
};

const onResize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const aspect = canvas.width / canvas.height;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewWidth = viewportWidth * 0.5;
  const viewSize = 5;

  const size = [viewportWidth, viewportHeight];
  const totalSize = [viewportWidth, viewportHeight];

  perspectiveCamera.set({
    aspect,
    view: {
      offset: [viewWidth * 0.5, 0],
      size,
      totalSize,
    },
  });

  orthographicCamera.set({
    left: (-0.5 * viewSize * aspect) / 2,
    right: (0.5 * viewSize * aspect) / 2,
    top: (0.5 * viewSize) / 2,
    bottom: (-0.5 * viewSize) / 2,
    view: {
      offset: [-viewWidth * 0.5, 0],
      size,
      totalSize,
    },
  });
};
window.addEventListener("resize", onResize);
onResize();

// GUI
const addOrbiterGui = (orbiter) => {
  gui.addParam("easing", orbiter, "easing", { min: 0, max: 1 });
  gui.addParam("zoom", orbiter, "zoom");
  gui.addParam("pan", orbiter, "pan");
  gui.addParam("drag", orbiter, "drag");
  gui.addParam("minDistance", orbiter, "minDistance", { min: 0, max: 10 });
  gui.addParam("maxDistance", orbiter, "maxDistance", { min: 10, max: 100 });
  gui.addParam("minLat", orbiter, "minLat", { min: -89.5, max: 10 });
  gui.addParam("maxLat", orbiter, "maxLat", { min: 10, max: 89.5 });
  gui.addParam("minLon", orbiter, "minLon", { min: -1000, max: 0 });
  gui.addParam("maxLon", orbiter, "maxLon", { min: 0, max: 1000 });
  gui.addParam("panSlowdown", orbiter, "panSlowdown", { min: 0, max: 10 });
  gui.addParam("zoomSlowdown", orbiter, "zoomSlowdown", { min: 0, max: 1000 });
  gui.addParam("dragSlowdown", orbiter, "dragSlowdown", { min: 0, max: 10 });
  gui.addParam("autoUpdate", orbiter, "autoUpdate", null, (v) =>
    orbiter.set({ autoUpdate: v })
  );
};

gui.addColumn("Perspective");
addOrbiterGui(perspectiveOrbiter);
gui.addSeparator();
gui.addParam("fov", State, "fov", { min: Math.PI / 8, max: Math.PI / 2 }, () =>
  perspectiveCamera.set({ fov: State.fov })
);
gui.addColumn("Orthographic");
addOrbiterGui(orthographicOrbiter);

gui.addColumn("Shared");
gui.addParam("Distance", State, "distance", { min: 2, max: 20 }, () => {
  perspectiveOrbiter.set({ distance: State.distance });
  orthographicOrbiter.set({ distance: State.distance });
});

// Frame
ctx.frame(() => {
  ctx.submit(clearCmd);
  ctx.submit(drawCubeCmd, {
    uniforms: {
      uProjectionMatrix: perspectiveCamera.projectionMatrix,
      uViewMatrix: perspectiveCamera.viewMatrix,
      uModelMatrix: mat4.create(),
    },
  });
  ctx.submit(drawCubeCmd, {
    uniforms: {
      uProjectionMatrix: orthographicCamera.projectionMatrix,
      uViewMatrix: orthographicCamera.viewMatrix,
      uModelMatrix: mat4.create(),
    },
  });

  gui.draw();
});
