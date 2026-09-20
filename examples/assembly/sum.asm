    MOV R0, 0
    MOV R1, 0
    MOV R15, 0
    MOV R11, 1
    MOV R4, 0x0101
    LD R3, [0x0100]
    CMP R3, R15
    JZ done
loop:
    LD R6, [R4]
    SAR R7, R6, 15       ; расширить знак до старшего слова
    ADD R0, R0, R6
    ADC R1, R1, R7       ; перенос от младшего слова
    ADD R4, R4, R11
    SUB R3, R3, R11
    JNZ loop            ; флаг нуля от уменьшения счётчика
done:
    ST [0x0300], R0
    ST [0x0301], R1
    HALT
