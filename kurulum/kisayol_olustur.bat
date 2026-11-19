@echo off
rem Alpotech Klinik masaustu kisayolunu olusturur. Cift tiklayin.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kisayol_olustur.ps1" %*
