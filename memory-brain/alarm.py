import datetime
import time
import winsound

# Set the alarm time
alarm_time = datetime.datetime.now() + datetime.timedelta(minutes=10)

while True:
    current_time = datetime.datetime.now()
    if current_time >= alarm_time:
        print('Alarm time!')
        winsound.Beep(2500, 1000)
        break
    else:
        time.sleep(1)