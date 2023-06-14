/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import { Howl } from 'howler';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

import soundUrl from './assets/hey_sondn.mp3';
import './App.css';

const sound = new Howl({
  src: [soundUrl],
});

const NOT_TOUCH_LABEL = 'not-touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

const App: React.FC = () => {
  const [startTraining, setStartTraining] = useState(false);
  const [touched, setTouched] = useState(false);

  const video = useRef<any>();
  const classifier = useRef<any>();
  const mobilenetModule = useRef<any>();
  const canPlaySound = useRef<any>(true);

  let newVariable: any = window.navigator;

  let isDev = process.env.NODE_ENV === 'development';

  const init = async () => {
    isDev && console.log('init...');

    await setupCamera();

    isDev && console.log('setup camera successfully');

    classifier.current = knnClassifier.create();

    mobilenetModule.current = await mobilenet.load();

    isDev && console.log('setup done');

    setStartTraining(true);

    isDev && console.log('Không chạm tay vào mặt và nhấn Train 1');

    initNotifications({ cooldown: 3000 });
  };

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      newVariable.getUserMedia =
        newVariable.getUserMedia ||
        newVariable.webkitGetUserMedia ||
        newVariable.mozGetUserMedia ||
        newVariable.msGetUserMedia;

      if (newVariable.getUserMedia) {
        newVariable.getUserMedia(
          { video: true },

          (stream: any) => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve);
          },

          (error: any) => reject(error)
        );
      } else {
        reject();
      }
    });
  };

  const train = async (label: string) => {
    for (let i = 0; i < TRAINING_TIMES; i++) {
      let progress = ((i + 1) / TRAINING_TIMES) * 100;

      isDev &&
        console.log(
          `[${label.toUpperCase()}] Progress: ${parseInt(progress.toString())}%`
        );

      await training(label);
    }
  };

  /**
   * Bước 1: Train cho máy khuôn mặt không có chạm tay
   * Bước 2: Train cho máy khuôn mặt có chạm tay
   * Bước 3: Lấy hình ảnh hiện tại, phân tích và so sách với data đã học trước đó
   * ==> Nếu mà matching với data khuôn mặt chạm tay ==> Cảnh báo
   * @param label
   * @returns
   */

  const training = (label: string) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenetModule.current.infer(video.current, true);

      classifier.current.addExample(embedding, label);

      await sleep(100);

      resolve('training done');
    });
  };

  const run = async () => {
    const embedding = mobilenetModule.current.infer(video.current, true);

    const result = await classifier.current.predictClass(embedding);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      isDev && console.log('Touched');

      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify('Bỏ tay ra!', { body: 'Bạn vừa chạm tay vào mặt!' });
      setTouched(true);
    } else {
      isDev && console.log('Not Touched');
      sound.stop();
      setTouched(false);
    }

    await sleep(200);

    run();
  };

  const sleep = (ms: number = 0) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };

  useEffect(() => {
    init();

    sound.on('end', () => {
      canPlaySound.current = true;
    });

    isDev && console.log(process.env.NODE_ENV);

    return () => {};
  }, []);

  return (
    <div className={`main ${touched ? 'touched' : ''}`}>
      <video ref={video} className='video' autoPlay />

      {startTraining && (
        <div className='control'>
          <button className='btn' onClick={() => train(NOT_TOUCH_LABEL)}>
            Train 1
          </button>
          <button className='btn' onClick={() => train(TOUCHED_LABEL)}>
            Train 2
          </button>
          <button className='btn' onClick={() => run()}>
            Run
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
