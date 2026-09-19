; Сумма 3 + 2 + 1 через цикл процессора.
    MOV R0, 0
    MOV R1, 3
    MOV R2, 1
loop:
    ADD R0, R0, R1
    SUB R1, R1, R2
    JNZ loop
    ST [0x0300], R0
    HALT
