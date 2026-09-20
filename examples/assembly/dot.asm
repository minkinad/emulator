    MOV R0, 0
    MOV R1, 0
    MOV R2, 0
    MOV R11, 1
    MOV R12, 10
    MOV R14, 0
    LD R3, [0x0100]
    CMP R3, R12
    JNZ invalid_length
    LD R13, [0x0200]
    CMP R13, R12
    JNZ invalid_length
    MOV R4, 0x0101
    MOV R5, 0x0201
loop:
    LD R6, [R4]
    LD R7, [R5]
    MULLO R8, R6, R7
    MULHI R9, R6, R7
    SAR R10, R9, 15      ; знак произведения в третье слово
    ADD R0, R0, R8
    ADC R1, R1, R9
    ADC R2, R2, R10
    ADD R4, R4, R11
    ADD R5, R5, R11
    SUB R3, R3, R11
    JNZ loop
    ST [0x0300], R0
    ST [0x0301], R1
    ST [0x0302], R2
    ST [0x0303], R14
    HALT
invalid_length:
    MOV R14, 1
    ST [0x0303], R14
    HALT
